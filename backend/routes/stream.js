import express from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { analyseKeyPoints } from "../services/brdAgent.js";
import { generateBRD, enhanceBRD } from "../services/brdGenerator.js";
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

// GET /api/stream/channels/:requestId/important — list important messages
router.get("/channels/:requestId/important", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rows } = await pool.query(
      `SELECT stream_message_id, message_text, sender_name, marked_at
       FROM important_messages WHERE request_id = $1 ORDER BY marked_at ASC`,
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

// POST /api/stream/channels/:requestId/generate-key-points — BA-only AI analysis
router.post("/channels/:requestId/generate-key-points", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;

    // Fetch request metadata
    const { rows: reqRows } = await pool.query(
      `SELECT r.title, r.description, r.category, r.priority, r.status,
              u.name AS stakeholder_name, u.email AS stakeholder_email
       FROM requests r
       LEFT JOIN users u ON u.id = r.stakeholder_id
       WHERE r.id = $1`,
      [requestId]
    );
    if (!reqRows.length) return res.status(404).json({ message: "Request not found" });

    // Fetch all marked key-point messages
    const { rows: msgs } = await pool.query(
      `SELECT stream_message_id, message_text, sender_name, marked_at
       FROM important_messages WHERE request_id = $1 ORDER BY marked_at ASC`,
      [requestId]
    );

    const analysis = await analyseKeyPoints(msgs, reqRows[0]);
    res.json(analysis);
  } catch (err) {
    console.error("BRD agent error:", err);
    res.status(500).json({ message: "Analysis failed" });
  }
});

// POST /api/stream/channels/:requestId/generate-brd — BA-only full BRD generation
router.post("/channels/:requestId/generate-brd", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") return res.status(403).json({ message: "BA only" });
    const { requestId } = req.params;
    const { analysis } = req.body; // pre-computed analysis JSON from generate-key-points
    if (!analysis) return res.status(400).json({ message: "analysis payload required" });

    const { rows: reqRows } = await pool.query(
      `SELECT r.id, r.req_number, r.title, r.description, r.category, r.priority, r.status,
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

    const brd = await generateBRD(analysis, reqRows[0], msgs);

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

export default router;
