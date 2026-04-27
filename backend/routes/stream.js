import express from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { analyseKeyPoints } from "../services/brdAgent.js";
import { generateBRD, enhanceBRD } from "../services/brdGenerator.js";
import { checkCompleteness, generateScope, generateWorkflow } from "../services/scopeWorkflowService.js";
import { getRequestDocumentContext, formatDocumentContext } from "../services/documentParser.js";
import { analyzeDocumentsForBRD, formatDocumentAnalysisForContext } from "../services/documentAnalysisService.js";
import { generateFRD } from "../services/frdGenerator.js";
import { generateTestCases } from "../services/testCaseGenerator.js";
import {
  upsertStreamUser,
  generateStreamToken,
  getOrCreateRequestChannel,
  addMemberToChannel,
  removeMemberFromChannel,
  sendMessageToChannel,
} from "../services/streamService.js";

const router = express.Router();

// GET /api/stream/token — exchange app JWT for a Stream user token
router.get("/token", authenticateToken, async (req, res) => {
  try {
    const { id, email, role } = req.user;
    const { rows } = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [id]
    );
    const user = rows[0];
    await upsertStreamUser({ id, name: user?.name, email, role });
    const token = generateStreamToken(id);
    res.json({ token, apiKey: process.env.STREAM_API_KEY, userId: String(id) });
  } catch (err) {
    console.error("Stream token error:", err);
    res.status(500).json({ message: "Failed to generate Stream token" });
  }
});

// POST /api/stream/channels/:requestId — BA creates/ensures channel exists
router.post("/channels/:requestId", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;

    const { rows } = await pool.query(
      "SELECT req_number, stakeholder_id FROM requests WHERE id = $1 AND assigned_ba_id = $2",
      [requestId, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ message: "Not your request" });

    const { req_number, stakeholder_id } = rows[0];
    const result = await getOrCreateRequestChannel(requestId, req.user.id, req_number);

    // Mirror BA in channel_members
    await pool.query(
      `INSERT INTO channel_members (request_id, user_id, stream_role)
       VALUES ($1, $2, 'moderator') ON CONFLICT (request_id, user_id) DO NOTHING`,
      [requestId, req.user.id]
    );

    // Auto-add the stakeholder as member if not already present
    if (stakeholder_id) {
      const alreadyIn = await pool.query(
        "SELECT 1 FROM channel_members WHERE request_id = $1 AND user_id = $2",
        [requestId, stakeholder_id]
      );
      if (!alreadyIn.rows.length) {
        const sh = await pool.query(
          "SELECT id, email, name, role FROM users WHERE id = $1",
          [stakeholder_id]
        );
        if (sh.rows.length) {
          await upsertStreamUser(sh.rows[0]);
          await addMemberToChannel(requestId, stakeholder_id, "member");
          await pool.query(
            `INSERT INTO channel_members (request_id, user_id, stream_role)
             VALUES ($1, $2, 'member') ON CONFLICT (request_id, user_id) DO NOTHING`,
            [requestId, stakeholder_id]
          );
        }
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Create channel error:", err);
    res.status(500).json({ message: "Failed to create channel" });
  }
});

// POST /api/stream/channels/:requestId/members — BA adds a user to the channel
router.post("/channels/:requestId/members", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;
    const { userId, role: memberRole } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });

    // Verify BA owns this channel
    const { rows: owns } = await pool.query(
      "SELECT id FROM requests WHERE id = $1 AND assigned_ba_id = $2",
      [requestId, req.user.id]
    );
    if (!owns.length) return res.status(403).json({ message: "Not your request" });

    const { rows: target } = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [userId]
    );
    if (!target.length) return res.status(404).json({ message: "User not found" });

    const streamRole = memberRole === "moderator" ? "moderator" : "member";
    await upsertStreamUser(target[0]);
    await addMemberToChannel(requestId, userId, streamRole);

    await pool.query(
      `INSERT INTO channel_members (request_id, user_id, stream_role)
       VALUES ($1, $2, $3)
       ON CONFLICT (request_id, user_id) DO UPDATE SET stream_role = EXCLUDED.stream_role`,
      [requestId, userId, streamRole]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ message: "Failed to add member" });
  }
});

// DELETE /api/stream/channels/:requestId/members/:userId — BA removes a user
router.delete("/channels/:requestId/members/:userId", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId, userId } = req.params;

    await removeMemberFromChannel(requestId, userId);
    await pool.query(
      "DELETE FROM channel_members WHERE request_id = $1 AND user_id = $2",
      [requestId, userId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({ message: "Failed to remove member" });
  }
});

// GET /api/stream/channels/:requestId/members — list current members (DB-backed)
router.get("/channels/:requestId/members", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, cm.stream_role, cm.added_at
       FROM channel_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.request_id = $1
       ORDER BY cm.added_at ASC`,
      [requestId]
    );
    res.json({ members: rows });
  } catch (err) {
    console.error("Get members error:", err);
    res.status(500).json({ message: "Failed to get members" });
  }
});

// GET /api/stream/users — list all users for BA's add-member dropdown
router.get("/users", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { rows } = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id != $1 ORDER BY role, name, email",
      [req.user.id]
    );
    res.json({ users: rows });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ message: "Failed to list users" });
  }
});

// GET /api/stream/channels/:requestId/important — list important messages (all roles)
router.get("/channels/:requestId/important", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rows } = await pool.query(
      `SELECT im.stream_message_id, im.message_text, im.sender_name, im.marked_at,
              u.name AS marked_by_name, u.email AS marked_by_email
       FROM important_messages im
       LEFT JOIN users u ON u.id = im.marked_by
       WHERE im.request_id = $1 ORDER BY im.marked_at ASC`,
      [requestId]
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error("Get important messages error:", err);
    res.status(500).json({ message: "Failed to get important messages" });
  }
});

// POST /api/stream/channels/:requestId/important — mark a message as important
router.post("/channels/:requestId/important", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { streamMessageId, messageText, senderName } = req.body;
    if (!streamMessageId) return res.status(400).json({ message: "streamMessageId required" });
    await pool.query(
      `INSERT INTO important_messages (request_id, stream_message_id, message_text, sender_name, marked_by)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (request_id, stream_message_id) DO NOTHING`,
      [requestId, streamMessageId, messageText || "", senderName || "", req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Mark important error:", err);
    res.status(500).json({ message: "Failed to mark message" });
  }
});

// DELETE /api/stream/channels/:requestId/important/:messageId — unmark a message
router.delete("/channels/:requestId/important/:messageId", authenticateToken, async (req, res) => {
  try {
    const { requestId, messageId } = req.params;
    await pool.query(
      `DELETE FROM important_messages WHERE request_id = $1 AND stream_message_id = $2`,
      [requestId, messageId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Unmark important error:", err);
    res.status(500).json({ message: "Failed to unmark message" });
  }
});

// POST /api/stream/channels/:requestId/analyze-documents — AI document intelligence extraction (BA only)
router.post("/channels/:requestId/analyze-documents", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;

    // Ensure the document_analyses table exists (idempotent)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_analyses (
        id          SERIAL PRIMARY KEY,
        request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        content     JSONB   NOT NULL,
        analyzed_by INTEGER REFERENCES users(id),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(request_id)
      )
    `);

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.title, r.description, r.category, r.priority
       FROM requests r WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: "Request not found" });

    const docs = await getRequestDocumentContext(requestId).catch(() => null);
    if (!docs || docs.length === 0) {
      return res.json({ no_documents: true, message: "No documents are attached to this request." });
    }

    const analysis = await analyzeDocumentsForBRD(docs, reqRows[0]);
    if (!analysis) return res.status(500).json({ message: "Document analysis failed." });

    // Persist / replace the analysis for this request
    await pool.query(
      `INSERT INTO document_analyses (request_id, content, analyzed_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (request_id) DO UPDATE
         SET content = EXCLUDED.content, analyzed_by = EXCLUDED.analyzed_by, created_at = NOW()`,
      [requestId, JSON.stringify(analysis), req.user.id]
    );

    res.json(analysis);
  } catch (err) {
    console.error("Document analysis error:", err);
    res.status(500).json({ message: "Document analysis failed", detail: err.message });
  }
});

// GET /api/stream/channels/:requestId/document-analysis — fetch stored document analysis
router.get("/channels/:requestId/document-analysis", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_analyses (
        id          SERIAL PRIMARY KEY,
        request_id  INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
        content     JSONB   NOT NULL,
        analyzed_by INTEGER REFERENCES users(id),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(request_id)
      )
    `);
    const { rows } = await pool.query(
      `SELECT content, created_at FROM document_analyses WHERE request_id = $1 LIMIT 1`,
      [requestId]
    );
    if (!rows.length) return res.json(null);
    res.json({ ...rows[0].content, _analyzed_at: rows[0].created_at });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch document analysis" });
  }
});

// POST /api/stream/channels/:requestId/generate-key-points — BA-only AI analysis
router.post("/channels/:requestId/generate-key-points", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.title, r.description, r.category, r.priority, r.status, r.created_at,
              u.name AS stakeholder_name, u.email AS stakeholder_email
       FROM requests r
       LEFT JOIN users u ON u.id = r.stakeholder_id
       WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: "Request not found" });

    const { rows: msgs } = await pool.query(
      `SELECT stream_message_id, message_text, sender_name, marked_at
       FROM important_messages WHERE request_id = $1 ORDER BY marked_at ASC`,
      [requestId]
    );

    // Parse attached documents and include in analysis context
    const docs = await getRequestDocumentContext(requestId).catch(() => null);
    const documentText = docs ? formatDocumentContext(docs) : "";

    const analysis = await analyseKeyPoints(msgs, reqRows[0], documentText);
    res.json(analysis);
  } catch (err) {
    console.error("BRD agent error:", err);
    res.status(500).json({ message: "Analysis failed" });
  }
});

// POST /api/stream/channels/:requestId/completeness-check — assess if discussion is ready
router.post("/channels/:requestId/completeness-check", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.title, r.description, r.category, r.priority, r.created_at,
              u.name AS stakeholder_name
       FROM requests r LEFT JOIN users u ON u.id = r.stakeholder_id
       WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: "Request not found" });

    const { rows: msgs } = await pool.query(
      `SELECT stream_message_id, message_text, sender_name, marked_at
       FROM important_messages WHERE request_id = $1 ORDER BY marked_at ASC`,
      [requestId]
    );

    const [docs, docAnalysisRows] = await Promise.all([
      getRequestDocumentContext(requestId).catch(() => null),
      pool.query(`SELECT content FROM document_analyses WHERE request_id = $1 LIMIT 1`, [requestId]).catch(() => ({ rows: [] })),
    ]);
    const documentText    = docs ? formatDocumentContext(docs) : "";
    const documentAnalysis = docAnalysisRows.rows[0]?.content || null;

    const result = await checkCompleteness(msgs, reqRows[0], documentText, documentAnalysis);
    res.json(result);
  } catch (err) {
    console.error("Completeness check error:", err);
    res.status(500).json({ message: "Completeness check failed", detail: err.message });
  }
});

// POST /api/stream/channels/:requestId/generate-scope — AI defines project scope
router.post("/channels/:requestId/generate-scope", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.title, r.description, r.category, r.priority, r.created_at
       FROM requests r WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: "Request not found" });

    const { rows: msgs } = await pool.query(
      `SELECT stream_message_id, message_text, sender_name, marked_at
       FROM important_messages WHERE request_id = $1 ORDER BY marked_at ASC`,
      [requestId]
    );

    const [docs, docAnalysisRows] = await Promise.all([
      getRequestDocumentContext(requestId).catch(() => null),
      pool.query(`SELECT content FROM document_analyses WHERE request_id = $1 LIMIT 1`, [requestId]).catch(() => ({ rows: [] })),
    ]);
    const documentText    = docs ? formatDocumentContext(docs) : "";
    const documentAnalysis = docAnalysisRows.rows[0]?.content || null;

    const scopeContent = await generateScope(msgs, reqRows[0], documentText, documentAnalysis);

    // Persist as draft scope
    const { rows: saved } = await pool.query(
      `INSERT INTO brd_scopes (request_id, content, status, created_by)
       VALUES ($1, $2, 'draft', $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [requestId, JSON.stringify(scopeContent), req.user.id]
    );

    // Upsert: if a scope already exists for this request, update it
    let scopeId;
    if (!saved.length) {
      const { rows: upd } = await pool.query(
        `UPDATE brd_scopes SET content = $1, status = 'draft', created_by = $2
         WHERE request_id = $3
         RETURNING id`,
        [JSON.stringify(scopeContent), req.user.id, requestId]
      );
      scopeId = upd[0]?.id;
    } else {
      scopeId = saved[0].id;
    }

    res.json({ scope_id: scopeId, ...scopeContent });
  } catch (err) {
    console.error("Generate scope error:", err);
    res.status(500).json({ message: "Scope generation failed", detail: err.message });
  }
});

// PATCH /api/stream/channels/:requestId/scope — BA saves edited scope and optionally approves
router.patch("/channels/:requestId/scope", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;
    const { content, approve } = req.body;
    if (!content) return res.status(400).json({ message: "content required" });

    const approvedAt = approve ? new Date() : null;
    const status = approve ? "approved" : "draft";

    await pool.query(
      `UPDATE brd_scopes
       SET content = $1, status = $2, approved_at = $3
       WHERE request_id = $4`,
      [JSON.stringify(content), status, approvedAt, requestId]
    );

    res.json({ ok: true, status });
  } catch (err) {
    console.error("Save scope error:", err);
    res.status(500).json({ message: "Failed to save scope" });
  }
});

// GET /api/stream/channels/:requestId/scope — fetch current scope
router.get("/channels/:requestId/scope", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rows } = await pool.query(
      `SELECT id, content, status, approved_at FROM brd_scopes
       WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [requestId]
    );
    if (!rows.length) return res.json(null);
    res.json({ scope_id: rows[0].id, ...rows[0].content, status: rows[0].status, approved_at: rows[0].approved_at });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch scope" });
  }
});

// POST /api/stream/channels/:requestId/generate-workflow — AI builds process workflow from approved scope
router.post("/channels/:requestId/generate-workflow", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;
    const { scope_content } = req.body; // BA may pass their edited scope directly

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.title, r.description, r.category, r.priority, r.created_at
       FROM requests r WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: "Request not found" });

    const { rows: msgs } = await pool.query(
      `SELECT stream_message_id, message_text, sender_name, marked_at
       FROM important_messages WHERE request_id = $1 ORDER BY marked_at ASC`,
      [requestId]
    );

    const [docs, docAnalysisRows] = await Promise.all([
      getRequestDocumentContext(requestId).catch(() => null),
      pool.query(`SELECT content FROM document_analyses WHERE request_id = $1 LIMIT 1`, [requestId]).catch(() => ({ rows: [] })),
    ]);
    const documentText    = docs ? formatDocumentContext(docs) : "";
    const documentAnalysis = docAnalysisRows.rows[0]?.content || null;

    // Use provided scope or fall back to the saved approved scope
    let approvedScope = scope_content;
    if (!approvedScope) {
      const { rows: scopeRows } = await pool.query(
        `SELECT content FROM brd_scopes WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [requestId]
      );
      if (scopeRows.length) approvedScope = scopeRows[0].content;
    }

    if (!approvedScope?.in_scope?.length) {
      return res.status(400).json({ message: "No approved scope found. Please generate and approve a scope first." });
    }

    const workflowContent = await generateWorkflow(approvedScope, msgs, reqRows[0], documentText, documentAnalysis);

    // Persist as draft workflow
    const { rows: scopeRow } = await pool.query(
      `SELECT id FROM brd_scopes WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [requestId]
    );
    const scopeId = scopeRow[0]?.id || null;

    await pool.query(
      `INSERT INTO brd_workflows (request_id, scope_id, content, status, created_by)
       VALUES ($1, $2, $3, 'draft', $4)
       ON CONFLICT DO NOTHING`,
      [requestId, scopeId, JSON.stringify(workflowContent), req.user.id]
    );

    // Upsert if already exists
    await pool.query(
      `UPDATE brd_workflows SET content = $1, status = 'draft', created_by = $2
       WHERE request_id = $3 AND id NOT IN (
         SELECT id FROM brd_workflows WHERE request_id = $3 ORDER BY created_at DESC LIMIT 0
       )`,
      [JSON.stringify(workflowContent), req.user.id, requestId]
    );

    const { rows: wfRows } = await pool.query(
      `SELECT id FROM brd_workflows WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [requestId]
    );

    res.json({ workflow_id: wfRows[0]?.id, ...workflowContent });
  } catch (err) {
    console.error("Generate workflow error:", err);
    res.status(500).json({ message: "Workflow generation failed", detail: err.message });
  }
});

// PATCH /api/stream/channels/:requestId/workflow — BA saves edited workflow and optionally approves
router.patch("/channels/:requestId/workflow", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;
    const { content, approve } = req.body;
    if (!content) return res.status(400).json({ message: "content required" });

    const approvedAt = approve ? new Date() : null;
    const status = approve ? "approved" : "draft";

    await pool.query(
      `UPDATE brd_workflows
       SET content = $1, status = $2, approved_at = $3
       WHERE request_id = $4`,
      [JSON.stringify(content), status, approvedAt, requestId]
    );

    res.json({ ok: true, status });
  } catch (err) {
    console.error("Save workflow error:", err);
    res.status(500).json({ message: "Failed to save workflow" });
  }
});

// GET /api/stream/channels/:requestId/workflow — fetch current workflow
router.get("/channels/:requestId/workflow", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rows } = await pool.query(
      `SELECT id, content, status, approved_at FROM brd_workflows
       WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [requestId]
    );
    if (!rows.length) return res.json(null);
    res.json({ workflow_id: rows[0].id, ...rows[0].content, status: rows[0].status, approved_at: rows[0].approved_at });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch workflow" });
  }
});

// PATCH /api/stream/brd-documents/:brdId/sections — BA edits a specific section of the BRD
router.patch("/brd-documents/:brdId/sections", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { brdId } = req.params;
    const { section, value } = req.body;
    if (!section || value === undefined) return res.status(400).json({ message: "section and value required" });

    const { rows } = await pool.query(
      "SELECT content FROM brd_documents WHERE id = $1 AND generated_by = $2",
      [brdId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: "BRD not found" });

    const content = rows[0].content;
    // Support dot-path: "sections.executive_summary.text"
    const parts = section.split(".");
    let target = content;
    for (let i = 0; i < parts.length - 1; i++) {
      if (target[parts[i]] === undefined) target[parts[i]] = {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;

    await pool.query(
      "UPDATE brd_documents SET content = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(content), brdId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("BRD section edit error:", err);
    res.status(500).json({ message: "Failed to update BRD section" });
  }
});

// POST /api/stream/channels/:requestId/generate-brd — BA-only full BRD generation
router.post("/channels/:requestId/generate-brd", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;
    const { analysis } = req.body;
    if (!analysis) return res.status(400).json({ message: "analysis payload required" });

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.req_number, r.title, r.description, r.category, r.priority, r.status, r.created_at,
              u.name AS stakeholder_name, u.email AS stakeholder_email
       FROM requests r
       LEFT JOIN users u ON u.id = r.stakeholder_id
       WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: "Request not found" });

    const { rows: msgs } = await pool.query(
      `SELECT stream_message_id, message_text, sender_name, marked_at
       FROM important_messages WHERE request_id = $1 ORDER BY marked_at ASC`,
      [requestId]
    );

    // Fetch documents, approved workflow, approved scope, and stored document analysis
    const [docs, wfRows, scopeRows, docAnalysisRows] = await Promise.all([
      getRequestDocumentContext(requestId).catch(() => null),
      pool.query(
        `SELECT content FROM brd_workflows WHERE request_id = $1 AND status = 'approved'
         ORDER BY created_at DESC LIMIT 1`,
        [requestId]
      ),
      pool.query(
        `SELECT content FROM brd_scopes WHERE request_id = $1 AND status = 'approved'
         ORDER BY created_at DESC LIMIT 1`,
        [requestId]
      ),
      pool.query(
        `SELECT content FROM document_analyses WHERE request_id = $1 LIMIT 1`,
        [requestId]
      ).catch(() => ({ rows: [] })),
    ]);
    const documentText     = docs ? formatDocumentContext(docs) : "";
    const approvedWorkflow  = wfRows.rows[0]?.content        || null;
    const approvedScope     = scopeRows.rows[0]?.content     || null;
    const documentAnalysis  = docAnalysisRows.rows[0]?.content || null;

    const brd = await generateBRD(analysis, reqRows[0], msgs, documentText, approvedWorkflow, approvedScope, documentAnalysis);

    // Upsert: one draft BRD per request (replace previous draft)
    const { rows: existing } = await pool.query(
      "SELECT id FROM brd_documents WHERE request_id = $1 ORDER BY generated_at DESC LIMIT 1",
      [requestId]
    );

    let brdId;
    if (existing.length) {
      const { rows } = await pool.query(
        `UPDATE brd_documents SET content = $1, version = $2, status = 'Draft',
         generated_by = $3, generated_at = NOW(), updated_at = NOW()
         WHERE id = $4 RETURNING id`,
        [JSON.stringify(brd), brd.meta.version, req.user.id, existing[0].id]
      );
      brdId = rows[0].id;
    } else {
      const { rows } = await pool.query(
        `INSERT INTO brd_documents (request_id, doc_id, version, status, content, generated_by)
         VALUES ($1, $2, $3, 'Draft', $4, $5) RETURNING id`,
        [requestId, brd.meta.doc_id, brd.meta.version, JSON.stringify(brd), req.user.id]
      );
      brdId = rows[0].id;
    }

    res.json({ ...brd, _db_id: brdId });
  } catch (err) {
    console.error("BRD generation error:", err);
    res.status(500).json({ message: "BRD generation failed", detail: err.message });
  }
});

// GET /api/stream/brd-documents — list all BRDs for the authenticated BA (with review counts)
router.get("/brd-documents", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { rows } = await pool.query(
      `SELECT bd.id, bd.doc_id, bd.version, bd.status, bd.generated_at, bd.updated_at,
              r.id AS request_id, r.title AS request_title, r.req_number, r.priority, r.category,
              bd.content->'meta'->>'source_messages' AS source_messages,
              COUNT(br.id) FILTER (WHERE br.status = 'pending')           AS reviews_pending,
              COUNT(br.id) FILTER (WHERE br.status = 'approved')          AS reviews_approved,
              COUNT(br.id) FILTER (WHERE br.status = 'changes_requested') AS reviews_changes,
              COUNT(br.id)                                                  AS reviews_total
       FROM brd_documents bd
       JOIN requests r ON r.id = bd.request_id
       LEFT JOIN brd_reviews br ON br.brd_document_id = bd.id
       WHERE bd.generated_by = $1
       GROUP BY bd.id, r.id
       ORDER BY bd.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch BRD list error:", err);
    res.status(500).json({ message: "Failed to fetch BRD documents" });
  }
});

// GET /api/stream/brd-documents/:brdId — get a full BRD document
router.get("/brd-documents/:brdId", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT bd.*, r.title AS request_title, r.req_number
       FROM brd_documents bd
       JOIN requests r ON r.id = bd.request_id
       WHERE bd.id = $1`,
      [req.params.brdId]
    );
    if (!rows.length) return res.status(404).json({ message: "BRD not found" });
    // Allow BA author or any team member to read
    res.json({ ...rows[0].content, _db_id: rows[0].id, _status: rows[0].status });
  } catch (err) {
    console.error("Fetch BRD error:", err);
    res.status(500).json({ message: "Failed to fetch BRD" });
  }
});

// PATCH /api/stream/brd-documents/:brdId/status — update BRD status
router.patch("/brd-documents/:brdId/status", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { status } = req.body;
    const validStatuses = ["Draft", "In Review", "Approved", "Final"];
    if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status" });
    await pool.query(
      "UPDATE brd_documents SET status = $1, updated_at = NOW() WHERE id = $2 AND generated_by = $3",
      [status, req.params.brdId, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to update status" });
  }
});

// POST /api/stream/brd-documents/:brdId/post-to-channel — BA shares BRD to the discussion channel
router.post("/brd-documents/:brdId/post-to-channel", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { brdId } = req.params;

    // Fetch the BRD and its linked request
    const { rows: brdRows } = await pool.query(
      `SELECT bd.*, r.id AS request_id, r.req_number, r.title, r.category, r.priority
       FROM brd_documents bd JOIN requests r ON r.id = bd.request_id
       WHERE bd.id = $1 AND bd.generated_by = $2`,
      [brdId, req.user.id]
    );
    if (!brdRows.length) return res.status(404).json({ message: "BRD not found or not yours" });
    const brd = brdRows[0];

    // Get all channel members (excluding the BA themselves)
    const { rows: members } = await pool.query(
      `SELECT u.id, u.name, u.email FROM channel_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.request_id = $1 AND cm.user_id != $2`,
      [brd.request_id, req.user.id]
    );

    // Upsert a 'pending' review row for each member
    for (const m of members) {
      await pool.query(
        `INSERT INTO brd_reviews (brd_document_id, reviewer_id, reviewer_name, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (brd_document_id, reviewer_id)
         DO UPDATE SET status = 'pending', comment = NULL, reviewed_at = NOW()`,
        [brdId, m.id, m.name || m.email]
      );
    }

    // Post a rich message to the Stream channel with a BRD review attachment
    const { message } = await sendMessageToChannel(
      brd.request_id,
      `📄 **Draft BRD Ready for Review** — ${brd.title} (v${brd.version})\nPlease review the document and mark your approval or request changes.`,
      [
        {
          type: "brd_review",
          brd_id: parseInt(brdId),
          doc_id: brd.doc_id,
          title: brd.title,
          version: brd.version,
          request_id: brd.request_id,
        },
      ],
      req.user.id
    );

    // Record the post
    await pool.query(
      `INSERT INTO brd_channel_posts (brd_document_id, request_id, stream_message_id, posted_by)
       VALUES ($1, $2, $3, $4)`,
      [brdId, brd.request_id, message.id, req.user.id]
    );

    // Update BRD status to "In Review"
    await pool.query(
      "UPDATE brd_documents SET status = 'In Review', updated_at = NOW() WHERE id = $1",
      [brdId]
    );

    res.json({ ok: true, reviewers: members.length, streamMessageId: message.id });
  } catch (err) {
    console.error("Post BRD to channel error:", err);
    res.status(500).json({ message: "Failed to post BRD to channel", detail: err.message });
  }
});

// GET /api/stream/brd-documents/:brdId/reviews — get all reviews for a BRD
router.get("/brd-documents/:brdId/reviews", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT br.id, br.reviewer_id, br.reviewer_name, br.status, br.comment, br.reviewed_at
       FROM brd_reviews br WHERE br.brd_document_id = $1 ORDER BY br.reviewed_at ASC`,
      [req.params.brdId]
    );
    res.json({ reviews: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// POST /api/stream/brd-documents/:brdId/review — stakeholder submits approval or change request
router.post("/brd-documents/:brdId/review", authenticateToken, async (req, res) => {
  try {
    const { brdId } = req.params;
    const { status, comment } = req.body;
    if (!["approved", "changes_requested"].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved' or 'changes_requested'" });
    }

    const userName = req.user.name || req.user.email;

    // Upsert the reviewer's decision
    await pool.query(
      `INSERT INTO brd_reviews (brd_document_id, reviewer_id, reviewer_name, status, comment, reviewed_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (brd_document_id, reviewer_id)
       DO UPDATE SET status = $4, comment = $5, reviewed_at = NOW()`,
      [brdId, req.user.id, userName, status, comment || null]
    );

    // Check if ALL reviewers have approved (none pending or changes_requested)
    const { rows: remaining } = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status != 'approved') AS not_approved
       FROM brd_reviews WHERE brd_document_id = $1`,
      [brdId]
    );

    const { total, not_approved } = remaining[0];
    if (parseInt(total) > 0 && parseInt(not_approved) === 0) {
      // All approved — mark BRD as Approved
      await pool.query(
        "UPDATE brd_documents SET status = 'Approved', updated_at = NOW() WHERE id = $1",
        [brdId]
      );
      return res.json({ ok: true, allApproved: true });
    }

    res.json({ ok: true, allApproved: false });
  } catch (err) {
    console.error("Submit review error:", err);
    res.status(500).json({ message: "Failed to submit review" });
  }
});

// POST /api/stream/brd-documents/:brdId/enhance — BA triggers AI enhancement from feedback
router.post("/brd-documents/:brdId/enhance", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { brdId } = req.params;

    // Get BRD + request info
    const { rows: brdRows } = await pool.query(
      `SELECT bd.content, bd.request_id, r.id, r.req_number, r.title, r.category, r.priority
       FROM brd_documents bd JOIN requests r ON r.id = bd.request_id
       WHERE bd.id = $1 AND bd.generated_by = $2`,
      [brdId, req.user.id]
    );
    if (!brdRows.length) return res.status(404).json({ message: "BRD not found or not yours" });

    const { content: existingBrd, request_id } = brdRows[0];
    const requestInfo = brdRows[0];

    // Get all change-request comments
    const { rows: changeReviews } = await pool.query(
      `SELECT reviewer_name, comment FROM brd_reviews
       WHERE brd_document_id = $1 AND status = 'changes_requested' AND comment IS NOT NULL`,
      [brdId]
    );

    if (!changeReviews.length) {
      return res.status(400).json({ message: "No improvement comments to enhance from" });
    }

    // AI enhancement
    const enhanced = await enhanceBRD(existingBrd, changeReviews, requestInfo);

    // Replace the BRD in DB (same row — "replace with new version")
    await pool.query(
      `UPDATE brd_documents SET content = $1, doc_id = $2, version = $3, status = 'Draft',
       generated_at = NOW(), updated_at = NOW() WHERE id = $4`,
      [JSON.stringify(enhanced), enhanced.meta.doc_id, enhanced.meta.version, brdId]
    );

    // Reset all reviews to 'pending' for the new version
    await pool.query(
      "UPDATE brd_reviews SET status = 'pending', comment = NULL, reviewed_at = NOW() WHERE brd_document_id = $1",
      [brdId]
    );

    // Post the new version to the channel
    const { message } = await sendMessageToChannel(
      request_id,
      `🔄 **BRD Updated to v${enhanced.meta.version}** — ${enhanced.meta.title}\nAI has incorporated stakeholder feedback. Please review the updated document.`,
      [
        {
          type: "brd_review",
          brd_id: parseInt(brdId),
          doc_id: enhanced.meta.doc_id,
          title: enhanced.meta.title,
          version: enhanced.meta.version,
          request_id,
        },
      ],
      req.user.id
    );

    await pool.query(
      `INSERT INTO brd_channel_posts (brd_document_id, request_id, stream_message_id, posted_by)
       VALUES ($1, $2, $3, $4)`,
      [brdId, request_id, message.id, req.user.id]
    );

    res.json({ ...enhanced, _db_id: parseInt(brdId) });
  } catch (err) {
    console.error("BRD enhancement error:", err);
    res.status(500).json({ message: "BRD enhancement failed", detail: err.message });
  }
});

// POST /api/stream/brd-documents/:brdId/send-to-it-manager — BA sends approved BRD to IT Manager
router.post("/brd-documents/:brdId/send-to-it-manager", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { brdId } = req.params;

    // Verify BRD is Approved and belongs to this BA
    const { rows: brdRows } = await pool.query(
      `SELECT bd.id, bd.status, bd.version, bd.content->'meta'->>'title' AS title,
              r.title AS request_title, r.req_number
       FROM brd_documents bd JOIN requests r ON r.id = bd.request_id
       WHERE bd.id = $1 AND bd.generated_by = $2`,
      [brdId, req.user.id]
    );
    if (!brdRows.length) return res.status(404).json({ message: "BRD not found or not yours" });
    if (brdRows[0].status !== "Approved") {
      return res.status(400).json({ message: "BRD must be Approved before sending to IT Manager" });
    }

    // Find current IT Manager
    const { rows: managers } = await pool.query(
      "SELECT id, name, email FROM users WHERE is_it_manager = TRUE LIMIT 1"
    );
    if (!managers.length) {
      return res.status(404).json({ message: "No IT Manager assigned. Ask admin to designate one." });
    }
    const itManager = managers[0];

    // Mark BRD as Final
    await pool.query(
      "UPDATE brd_documents SET status = 'Final', updated_at = NOW() WHERE id = $1",
      [brdId]
    );

    // Record the submission
    await pool.query(
      `INSERT INTO brd_it_submissions (brd_document_id, submitted_by, it_manager_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [brdId, req.user.id, itManager.id]
    );

    res.json({ ok: true, itManager: itManager.name || itManager.email });
  } catch (err) {
    console.error("Send to IT Manager error:", err);
    res.status(500).json({ message: "Failed to send BRD to IT Manager", detail: err.message });
  }
});

// GET /api/stream/it-dashboard-stats — aggregated stats for IT dashboard
router.get("/it-dashboard-stats", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "it") return res.status(403).json({ message: "IT only" });

    const [
      brdStats,
      frdStats,
      tcStats,
      recentBrds,
      recentFrds,
      trend,
    ] = await Promise.all([
      // BRDs available to IT = all Approved/Final BRDs
      pool.query(`
        SELECT
          COUNT(*)::int                                                    AS total_received,
          COUNT(fd.id)::int                                                AS with_frd,
          COUNT(*) FILTER (WHERE fd.id IS NULL)::int                       AS pending_frd
        FROM brd_documents bd
        LEFT JOIN frd_documents fd ON fd.brd_document_id = bd.id
        WHERE bd.status IN ('Approved', 'Final')
      `),

      // FRD stats — count distinct FRDs (avoid duplicates from TC join)
      pool.query(`
        SELECT
          COUNT(*)::int                                                          AS total,
          COUNT(*) FILTER (WHERE fd.status = 'Draft')::int                      AS draft,
          COUNT(*) FILTER (WHERE fd.status = 'In Review')::int                  AS in_review,
          COUNT(*) FILTER (WHERE fd.status = 'Approved')::int                   AS approved,
          COUNT(DISTINCT tc.frd_document_id)::int                               AS with_test_cases
        FROM frd_documents fd
        LEFT JOIN test_case_documents tc ON tc.frd_document_id = fd.id
      `),

      // Test case stats
      pool.query(`
        SELECT
          COUNT(*)::int                                                         AS total_suites,
          COALESCE(SUM((content->'meta'->>'total_cases')::int), 0)::int        AS total_cases,
          COALESCE(SUM((content->'meta'->'summary'->>'critical')::int), 0)::int AS critical,
          COALESCE(SUM((content->'meta'->'summary'->>'system')::int), 0)::int   AS system_cases,
          COALESCE(SUM((content->'meta'->'summary'->>'uat')::int), 0)::int      AS uat_cases
        FROM test_case_documents
      `),

      // Recent BRDs available to IT (last 5 Approved/Final)
      pool.query(`
        SELECT bd.id, bd.doc_id,
               bd.content->'meta'->>'title'    AS title,
               bd.content->'meta'->>'category' AS category,
               bd.content->'meta'->>'priority' AS priority,
               COALESCE(sub.submitted_at, bd.updated_at) AS submitted_at,
               u.name  AS submitted_by_name,
               CASE WHEN fd.id IS NOT NULL THEN true ELSE false END AS has_frd
        FROM brd_documents bd
        JOIN users u ON u.id = bd.generated_by
        LEFT JOIN frd_documents fd  ON fd.brd_document_id = bd.id
        LEFT JOIN brd_it_submissions sub ON sub.brd_document_id = bd.id
        WHERE bd.status IN ('Approved', 'Final')
        ORDER BY COALESCE(sub.submitted_at, bd.updated_at) DESC
        LIMIT 5
      `),

      // Recent FRDs generated (last 5)
      pool.query(`
        SELECT fd.id, fd.doc_id, fd.status, fd.generated_at,
               fd.content->'meta'->>'title' AS title,
               r.title AS request_title, r.req_number,
               CASE WHEN tc.id IS NOT NULL THEN true ELSE false END AS has_test_cases
        FROM frd_documents fd
        JOIN requests r ON r.id = fd.request_id
        LEFT JOIN test_case_documents tc ON tc.frd_document_id = fd.id
        ORDER BY fd.generated_at DESC
        LIMIT 5
      `),

      // 14-day activity trend — BRD approvals + FRD generations per day
      pool.query(`
        SELECT TO_CHAR(d.day, 'Mon DD') AS label,
               COALESCE(brd.brd_count, 0)::int AS brds,
               COALESCE(frd.frd_count, 0)::int AS frds
        FROM generate_series(NOW()::date - 13, NOW()::date, '1 day'::interval) AS d(day)
        LEFT JOIN (
          SELECT updated_at::date AS day, COUNT(*)::int AS brd_count
          FROM brd_documents
          WHERE status IN ('Approved', 'Final')
          GROUP BY updated_at::date
        ) brd ON brd.day = d.day
        LEFT JOIN (
          SELECT generated_at::date AS day, COUNT(*)::int AS frd_count
          FROM frd_documents GROUP BY generated_at::date
        ) frd ON frd.day = d.day
        ORDER BY d.day
      `),
    ]);

    res.json({
      brd_stats:   brdStats.rows[0],
      frd_stats:   frdStats.rows[0],
      tc_stats:    tcStats.rows[0],
      recent_brds: recentBrds.rows,
      recent_frds: recentFrds.rows,
      trend:       trend.rows,
    });
  } catch (err) {
    console.error("IT dashboard stats error:", err);
    res.status(500).json({ message: "Failed to fetch IT dashboard stats", detail: err.message });
  }
});

// GET /api/stream/approved-brds — IT users see all Approved/Final BRDs submitted to them
router.get("/approved-brds", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "it") return res.status(403).json({ message: "IT only" });
    const { rows } = await pool.query(
      `SELECT bd.id, bd.doc_id, bd.version, bd.status,
              bd.content->'meta'->>'title' AS title,
              bd.content->'meta'->>'category' AS category,
              bd.content->'meta'->>'priority' AS priority,
              bd.content->'sections'->'brd_readiness'->>'score' AS readiness_score,
              bd.content->'sections'->'executive_summary'->>'text' AS executive_summary,
              bd.content AS content,
              r.id AS request_id, r.title AS request_title, r.req_number, r.priority AS req_priority,
              r.category AS req_category,
              u.name AS author_name, u.email AS author_email,
              bd.generated_at, bd.updated_at,
              sub.submitted_at,
              COUNT(br.id) FILTER (WHERE br.status = 'approved') AS reviews_approved,
              COUNT(br.id) AS reviews_total
       FROM brd_documents bd
       JOIN requests r ON r.id = bd.request_id
       JOIN users u ON u.id = bd.generated_by
       LEFT JOIN brd_reviews br ON br.brd_document_id = bd.id
       LEFT JOIN brd_it_submissions sub ON sub.brd_document_id = bd.id
       WHERE bd.status IN ('Approved', 'Final')
       GROUP BY bd.id, r.id, u.id, sub.submitted_at
       ORDER BY COALESCE(sub.submitted_at, bd.updated_at) DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch approved BRDs error:", err);
    res.status(500).json({ message: "Failed to fetch approved BRDs" });
  }
});

// ── FRD Routes ────────────────────────────────────────────────────────────────

// POST /api/stream/brd-documents/:brdId/generate-frd — IT generates FRD from approved/final BRD
router.post("/brd-documents/:brdId/generate-frd", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "it") return res.status(403).json({ message: "IT only" });
    const { brdId } = req.params;

    const { rows: brdRows } = await pool.query(
      `SELECT bd.content, bd.status, bd.doc_id,
              r.id AS request_id, r.req_number, r.title
       FROM brd_documents bd JOIN requests r ON r.id = bd.request_id
       WHERE bd.id = $1 AND bd.status IN ('Approved', 'Final')`,
      [brdId]
    );
    if (!brdRows.length) return res.status(404).json({ message: "BRD not found or not yet approved" });

    const brdRow = brdRows[0];
    const frd    = generateFRD(brdRow.content, brdRow);

    const { rows: existing } = await pool.query(
      "SELECT id FROM frd_documents WHERE brd_document_id = $1",
      [brdId]
    );

    let frdId;
    if (existing.length) {
      const { rows } = await pool.query(
        `UPDATE frd_documents
         SET content = $1, doc_id = $2, version = $3, status = 'Draft',
             generated_at = NOW(), updated_at = NOW()
         WHERE id = $4 RETURNING id`,
        [JSON.stringify(frd), frd.meta.doc_id, frd.meta.version, existing[0].id]
      );
      frdId = rows[0].id;
    } else {
      const { rows } = await pool.query(
        `INSERT INTO frd_documents
           (brd_document_id, request_id, doc_id, version, status, content, generated_by)
         VALUES ($1, $2, $3, $4, 'Draft', $5, $6) RETURNING id`,
        [brdId, brdRow.request_id, frd.meta.doc_id, frd.meta.version, JSON.stringify(frd), req.user.id]
      );
      frdId = rows[0].id;
    }

    res.json({ ...frd, _db_id: frdId });
  } catch (err) {
    console.error("FRD generation error:", err);
    res.status(500).json({ message: "FRD generation failed", detail: err.message });
  }
});

// GET /api/stream/frd-documents — list all FRDs (IT only)
router.get("/frd-documents", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "it") return res.status(403).json({ message: "IT only" });

    const { rows } = await pool.query(
      `SELECT fd.id, fd.doc_id, fd.version, fd.status, fd.generated_at, fd.updated_at,
              fd.content->'meta'->>'title'    AS title,
              fd.content->'meta'->>'category' AS category,
              fd.content->'meta'->>'priority' AS priority,
              fd.content->'meta'->>'brd_doc_id' AS brd_doc_id,
              r.id AS request_id, r.title AS request_title, r.req_number,
              bd.id AS brd_id,
              (SELECT COUNT(*) FROM test_case_documents tc
               WHERE tc.frd_document_id = fd.id) AS tc_count,
              u.name AS author_name, u.email AS author_email
       FROM frd_documents fd
       JOIN requests      r  ON r.id  = fd.request_id
       JOIN brd_documents bd ON bd.id = fd.brd_document_id
       JOIN users         u  ON u.id  = fd.generated_by
       ORDER BY fd.updated_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch FRD list error:", err);
    res.status(500).json({ message: "Failed to fetch FRD documents" });
  }
});

// GET /api/stream/frd-documents/:frdId — get full FRD
router.get("/frd-documents/:frdId", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "it") return res.status(403).json({ message: "IT only" });
    const { rows } = await pool.query(
      `SELECT fd.*, r.req_number, r.title AS request_title
       FROM frd_documents fd JOIN requests r ON r.id = fd.request_id
       WHERE fd.id = $1`,
      [req.params.frdId]
    );
    if (!rows.length) return res.status(404).json({ message: "FRD not found" });
    res.json({ ...rows[0].content, _db_id: rows[0].id, _status: rows[0].status });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch FRD" });
  }
});

// ── Test Case Routes ──────────────────────────────────────────────────────────

// POST /api/stream/frd-documents/:frdId/generate-test-cases
router.post("/frd-documents/:frdId/generate-test-cases", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "it") return res.status(403).json({ message: "IT only" });
    const { frdId } = req.params;

    const { rows: frdRows } = await pool.query(
      `SELECT fd.content, fd.brd_document_id, fd.request_id, r.req_number, r.title
       FROM frd_documents fd JOIN requests r ON r.id = fd.request_id
       WHERE fd.id = $1`,
      [frdId]
    );
    if (!frdRows.length) return res.status(404).json({ message: "FRD not found" });

    const frdRow = frdRows[0];
    const tc     = generateTestCases(frdRow.content, frdRow);

    const { rows: existing } = await pool.query(
      "SELECT id FROM test_case_documents WHERE frd_document_id = $1",
      [frdId]
    );

    let tcId;
    if (existing.length) {
      const { rows } = await pool.query(
        `UPDATE test_case_documents
         SET content = $1, doc_id = $2, status = 'Draft', generated_at = NOW(), updated_at = NOW()
         WHERE id = $3 RETURNING id`,
        [JSON.stringify(tc), tc.meta.doc_id, existing[0].id]
      );
      tcId = rows[0].id;
    } else {
      const { rows } = await pool.query(
        `INSERT INTO test_case_documents
           (frd_document_id, brd_document_id, request_id, doc_id, version, status, content, generated_by)
         VALUES ($1, $2, $3, $4, $5, 'Draft', $6, $7) RETURNING id`,
        [frdId, frdRow.brd_document_id, frdRow.request_id,
         tc.meta.doc_id, tc.meta.version, JSON.stringify(tc), req.user.id]
      );
      tcId = rows[0].id;
    }

    res.json({ ...tc, _db_id: tcId });
  } catch (err) {
    console.error("Test case generation error:", err);
    res.status(500).json({ message: "Test case generation failed", detail: err.message });
  }
});

// GET /api/stream/test-case-documents — list all test case documents (IT / it_member)
router.get("/test-case-documents", authenticateToken, async (req, res) => {
  try {
    if (!["it", "it_member"].includes(req.user.role)) return res.status(403).json({ message: "IT role required" });

    const { rows } = await pool.query(
      `SELECT tc.id, tc.doc_id, tc.version, tc.status, tc.generated_at, tc.updated_at,
              tc.content->'meta'->>'title'                              AS title,
              (tc.content->'meta'->>'total_cases')::int                 AS total_cases,
              tc.content->'meta'->'summary'                             AS summary,
              tc.content->'meta'->>'frd_doc_id'                         AS frd_doc_id_meta,
              tc.content->'meta'->>'brd_doc_id'                         AS brd_doc_id,
              r.id AS request_id, r.title AS request_title, r.req_number,
              fd.doc_id AS frd_doc_id, fd.id AS frd_id,
              u.name AS generated_by_name, u.email AS generated_by_email,
              sr.pass_rate   AS sit_pass_rate,
              sr.released_at AS sit_released_at,
              CASE WHEN sr.id IS NOT NULL THEN true ELSE false END AS sit_released
       FROM test_case_documents tc
       JOIN frd_documents fd ON fd.id = tc.frd_document_id
       JOIN requests      r  ON r.id  = tc.request_id
       JOIN users         u  ON u.id  = tc.generated_by
       LEFT JOIN sit_releases sr ON sr.tc_document_id = tc.id
       ORDER BY tc.updated_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch TC list error:", err);
    res.status(500).json({ message: "Failed to fetch test case documents" });
  }
});

// GET /api/stream/test-case-documents/:tcId — get full test case document (IT / it_member)
router.get("/test-case-documents/:tcId", authenticateToken, async (req, res) => {
  try {
    if (!["it", "it_member"].includes(req.user.role)) return res.status(403).json({ message: "IT role required" });
    const { rows } = await pool.query(
      `SELECT tc.*, r.req_number, r.title AS request_title
       FROM test_case_documents tc JOIN requests r ON r.id = tc.request_id
       WHERE tc.id = $1`,
      [req.params.tcId]
    );
    if (!rows.length) return res.status(404).json({ message: "Test cases not found" });
    res.json({ ...rows[0].content, _db_id: rows[0].id, _status: rows[0].status });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch test cases" });
  }
});

// POST /api/stream/daily/rooms — create a Daily.co video room
router.post("/daily/rooms", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ message: "requestId required" });

    const roomName = `brd-${requestId}-${Date.now()}`;
    const exp = Math.floor(Date.now() / 1000) + 7200; // 2 hours

    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp,
          enable_prejoin_ui: true,
          enable_chat: false,
          enable_screenshare: true,
          max_participants: 20,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Daily API error:", text);
      return res.status(500).json({ message: "Failed to create Daily room" });
    }

    const data = await response.json();
    res.json({ url: data.url, name: data.name });
  } catch (err) {
    console.error("Daily room error:", err);
    res.status(500).json({ message: "Failed to create Daily room" });
  }
});

// GET /api/stream/it-member-dashboard — aggregated stats for IT member dashboard
router.get("/it-member-dashboard", authenticateToken, async (req, res) => {
  if (!["it", "it_member"].includes(req.user.role))
    return res.status(403).json({ message: "IT role required" });

  try {
    const [sitResults, sitTotal, uatStats, defectStats, deployStats, recentSit] = await Promise.all([
      // SIT: count by status from persisted results
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'Pass'        THEN 1 END), 0)::int AS passed,
          COALESCE(SUM(CASE WHEN status = 'Fail'        THEN 1 END), 0)::int AS failed,
          COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 END), 0)::int AS in_progress
        FROM sit_test_results
      `),
      // Total SIT cases from JSONB across all tc_documents
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM test_case_documents tc,
             jsonb_array_elements(tc.content->'test_cases') AS tc_case
        WHERE tc_case->>'type' IN ('System','Integration','Performance','Security')
      `),
      // UAT assignments by status
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'Pass'        THEN 1 END), 0)::int AS passed,
          COALESCE(SUM(CASE WHEN status = 'Fail'        THEN 1 END), 0)::int AS failed,
          COALESCE(SUM(CASE WHEN status = 'In Progress' THEN 1 END), 0)::int AS in_progress,
          COALESCE(SUM(CASE WHEN status = 'Pending'     THEN 1 END), 0)::int AS pending,
          COUNT(*)::int AS total
        FROM uat_assignments
      `),
      // Open defects (not resolved or closed)
      pool.query(`
        SELECT COUNT(*)::int AS open_count
        FROM production_defects
        WHERE status NOT IN ('Resolved','Closed')
      `),
      // Latest deployment status per environment
      pool.query(`
        SELECT DISTINCT ON (environment)
               environment, status, updated_at
        FROM deployments
        ORDER BY environment, updated_at DESC
      `),
      // 5 most recently updated SIT cases with title from JSONB
      pool.query(`
        SELECT str.test_case_id, str.status, str.updated_at,
          (SELECT elem->>'title'
           FROM jsonb_array_elements(tcd.content->'test_cases') AS elem
           WHERE elem->>'id' = str.test_case_id
           LIMIT 1) AS title
        FROM sit_test_results str
        JOIN test_case_documents tcd ON tcd.id = str.tc_document_id
        ORDER BY str.updated_at DESC
        LIMIT 5
      `),
    ]);

    const total   = sitTotal.rows[0].total;
    const passed  = sitResults.rows[0].passed;
    const failed  = sitResults.rows[0].failed;
    const inProg  = sitResults.rows[0].in_progress;
    const pending = Math.max(0, total - passed - failed - inProg);
    const sitRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const uatRow  = uatStats.rows[0];
    const uatRate = uatRow.total > 0 ? Math.round((uatRow.passed / uatRow.total) * 100) : 0;

    res.json({
      sit: { total, passed, failed, in_progress: inProg, pending, pass_rate: sitRate },
      uat: { ...uatRow, pass_rate: uatRate },
      open_defects: defectStats.rows[0].open_count,
      deployments:  deployStats.rows,
      recent_sit:   recentSit.rows,
    });
  } catch (err) {
    console.error("IT member dashboard error:", err);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

export default router;
