import express from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { postSystemActivity } from "../services/streamService.js";

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Verify the caller can access this tc_document (any authenticated user for reads,
 *  role-checks are done per-endpoint for writes). */
async function getTcDoc(tcDocId) {
  const { rows } = await pool.query(
    "SELECT id, request_id, content FROM test_case_documents WHERE id = $1",
    [tcDocId]
  );
  return rows[0] || null;
}

/** Split test cases in the JSONB content into SIT vs UAT buckets. */
const SIT_TYPES = new Set(["System", "Integration", "Performance", "Security"]);
function splitCases(content) {
  const all = content?.test_cases ?? [];
  return {
    sit: all.filter(tc => SIT_TYPES.has(tc.type)),
    uat: all.filter(tc => tc.type === "UAT"),
  };
}

/** Compute pass rate for a set of case IDs against persisted results. */
function computePassRate(caseIds, results) {
  if (!caseIds.length) return 0;
  const passed = caseIds.filter(id => results[id]?.status === "Pass").length;
  return Math.round((passed / caseIds.length) * 100);
}

// ─── SIT Endpoints ──────────────────────────────────────────────────────────

// GET /api/testing/sit/:tcDocId — full SIT state (cases + persisted results + release flag)
router.get("/sit/:tcDocId", authenticateToken, async (req, res) => {
  try {
    const doc = await getTcDoc(req.params.tcDocId);
    if (!doc) return res.status(404).json({ message: "Test case document not found" });

    const { sit, uat } = splitCases(doc.content);

    // Persisted results
    const { rows: resultRows } = await pool.query(
      "SELECT test_case_id, status, remarks, updated_at FROM sit_test_results WHERE tc_document_id = $1",
      [doc.id]
    );
    const results = Object.fromEntries(resultRows.map(r => [r.test_case_id, r]));

    // Release record
    const { rows: relRows } = await pool.query(
      "SELECT pass_rate, released_at FROM sit_releases WHERE tc_document_id = $1",
      [doc.id]
    );
    const release = relRows[0] || null;

    const passRate = computePassRate(sit.map(tc => tc.id), results);

    res.json({
      sit_cases: sit,
      uat_case_count: uat.length,
      results,
      pass_rate: passRate,
      released: !!release,
      released_at: release?.released_at ?? null,
    });
  } catch (err) {
    console.error("GET sit error:", err);
    res.status(500).json({ message: "Failed to fetch SIT data" });
  }
});

// PUT /api/testing/sit/:tcDocId — bulk-update SIT case statuses
// Body: { updates: [{ test_case_id, status, remarks }] }
router.put("/sit/:tcDocId", authenticateToken, async (req, res) => {
  try {
    const doc = await getTcDoc(req.params.tcDocId);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const { updates } = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ message: "updates array required" });

    for (const u of updates) {
      await pool.query(
        `INSERT INTO sit_test_results (tc_document_id, test_case_id, status, remarks, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (tc_document_id, test_case_id)
         DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks,
                       updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [doc.id, u.test_case_id, u.status, u.remarks ?? null, req.user.id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("PUT sit error:", err);
    res.status(500).json({ message: "Failed to update SIT results" });
  }
});

// POST /api/testing/sit/:tcDocId/release — release for UAT (requires ≥90% pass rate)
router.post("/sit/:tcDocId/release", authenticateToken, async (req, res) => {
  try {
    const doc = await getTcDoc(req.params.tcDocId);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const { sit } = splitCases(doc.content);
    const { rows: resultRows } = await pool.query(
      "SELECT test_case_id, status FROM sit_test_results WHERE tc_document_id = $1",
      [doc.id]
    );
    const results = Object.fromEntries(resultRows.map(r => [r.test_case_id, r]));
    const passRate = computePassRate(sit.map(tc => tc.id), results);

    if (passRate < 90) {
      return res.status(400).json({ message: `Pass rate is ${passRate}% — 90% required to release for UAT` });
    }

    await pool.query(
      `INSERT INTO sit_releases (tc_document_id, pass_rate, released_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (tc_document_id) DO UPDATE SET pass_rate = EXCLUDED.pass_rate, released_at = NOW()`,
      [doc.id, passRate, req.user.id]
    );

    // Update request status
    await pool.query(
      "UPDATE requests SET status = 'UAT Testing', updated_at = NOW() WHERE id = $1",
      [doc.request_id]
    );

    await postSystemActivity(
      doc.request_id,
      `🚀 SIT Testing completed with a ${passRate}% pass rate. This request has been released for UAT testing — the BA can now assign test cases to stakeholders.`
    );

    res.json({ ok: true, pass_rate: passRate });
  } catch (err) {
    console.error("POST sit release error:", err);
    res.status(500).json({ message: "Failed to release for UAT" });
  }
});

// ─── UAT Endpoints ──────────────────────────────────────────────────────────

// GET /api/testing/uat/documents — TC docs that have completed SIT (for BA UAT oversight)
// GET /api/testing/uat/my-cases — stakeholder sees their assigned UAT cases
// MUST be before /uat/:tcDocId
router.get("/uat/my-cases", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ua.id, ua.test_case_id, ua.status, ua.test_mode, ua.remarks,
              ua.manual_notes, ua.assigned_at, ua.updated_at,
              tcd.id AS tc_document_id, tcd.doc_id AS tc_doc_id,
              r.title AS request_title, r.req_number, r.id AS request_id,
              tcd.content
       FROM uat_assignments ua
       JOIN test_case_documents tcd ON tcd.id = ua.tc_document_id
       JOIN requests r ON r.id = tcd.request_id
       WHERE ua.stakeholder_id = $1
       ORDER BY ua.assigned_at DESC`,
      [req.user.id]
    );
    const enriched = rows.map(row => {
      const tcDef = (row.content?.test_cases ?? []).find(tc => tc.id === row.test_case_id) ?? {};
      const { content, ...rest } = row;
      return { ...rest, definition: tcDef };
    });
    res.json(enriched);
  } catch (err) {
    console.error("GET my-cases error:", err);
    res.status(500).json({ message: "Failed to fetch assigned cases" });
  }
});

// MUST be before /uat/:tcDocId to prevent static paths being caught as a param
router.get("/uat/documents", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tcd.id, tcd.doc_id, tcd.version, tcd.status, tcd.generated_at,
              tcd.content->'meta'->>'title' AS title,
              r.id AS request_id, r.title AS request_title, r.req_number,
              sr.pass_rate AS sit_pass_rate, sr.released_at
       FROM sit_releases sr
       JOIN test_case_documents tcd ON tcd.id = sr.tc_document_id
       JOIN requests r ON r.id = tcd.request_id
       ORDER BY sr.released_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET uat/documents error:", err);
    res.status(500).json({ message: "Failed to fetch UAT documents" });
  }
});

// GET /api/testing/uat/:tcDocId — assignments + config + pass rate
router.get("/uat/:tcDocId", authenticateToken, async (req, res) => {
  try {
    const doc = await getTcDoc(req.params.tcDocId);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const { uat } = splitCases(doc.content);

    // Assignments with stakeholder info
    const { rows: assignments } = await pool.query(
      `SELECT ua.id, ua.test_case_id, ua.stakeholder_id, ua.status, ua.test_mode,
              ua.remarks, ua.manual_notes, ua.assigned_at, ua.updated_at,
              u.name AS stakeholder_name, u.email AS stakeholder_email
       FROM uat_assignments ua
       JOIN users u ON u.id = ua.stakeholder_id
       WHERE ua.tc_document_id = $1
       ORDER BY ua.test_case_id, ua.assigned_at`,
      [doc.id]
    );

    // Config
    const { rows: cfgRows } = await pool.query(
      "SELECT pass_threshold FROM uat_config WHERE tc_document_id = $1",
      [doc.id]
    );
    const threshold = cfgRows[0]?.pass_threshold ?? 80;

    // Release status
    const { rows: sitRelRows } = await pool.query(
      "SELECT released_at FROM sit_releases WHERE tc_document_id = $1",
      [doc.id]
    );

    // Approval
    const { rows: approvalRows } = await pool.query(
      "SELECT id, status, pass_rate, submitted_at FROM approval_requests WHERE tc_document_id = $1",
      [doc.id]
    );

    const passed = assignments.filter(a => a.status === "Pass").length;
    const passRate = assignments.length > 0 ? Math.round((passed / assignments.length) * 100) : 0;

    res.json({
      uat_cases: uat,
      assignments,
      threshold,
      pass_rate: passRate,
      sit_released: !!sitRelRows[0],
      approval: approvalRows[0] ?? null,
    });
  } catch (err) {
    console.error("GET uat error:", err);
    res.status(500).json({ message: "Failed to fetch UAT data" });
  }
});

// POST /api/testing/uat/:tcDocId/assign — BA assigns a UAT case to a stakeholder
// Body: { test_case_id, stakeholder_id }
router.post("/uat/:tcDocId/assign", authenticateToken, async (req, res) => {
  try {
    if (!["ba", "it", "it_member"].includes(req.user.role)) {
      return res.status(403).json({ message: "BA or IT role required" });
    }
    const doc = await getTcDoc(req.params.tcDocId);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const { test_case_id, stakeholder_id } = req.body;
    if (!test_case_id || !stakeholder_id) {
      return res.status(400).json({ message: "test_case_id and stakeholder_id required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO uat_assignments (tc_document_id, test_case_id, stakeholder_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tc_document_id, test_case_id, stakeholder_id) DO NOTHING
       RETURNING *`,
      [doc.id, test_case_id, stakeholder_id, req.user.id]
    );

    if (rows[0]) {
      const { rows: shRows } = await pool.query(
        "SELECT name, email FROM users WHERE id = $1",
        [stakeholder_id]
      );
      const shName = shRows[0]?.name || shRows[0]?.email || `Stakeholder #${stakeholder_id}`;
      const tcDef = (doc.content?.test_cases ?? []).find(tc => tc.id === test_case_id);
      const tcName = tcDef?.name ?? test_case_id;
      await postSystemActivity(
        doc.request_id,
        `📋 UAT test case "${tcName}" has been assigned to ${shName} for testing.`
      );
    }

    res.status(201).json(rows[0] ?? { message: "Already assigned" });
  } catch (err) {
    console.error("POST uat assign error:", err);
    res.status(500).json({ message: "Failed to assign" });
  }
});

// DELETE /api/testing/uat/assignments/:id — BA / IT removes an assignment
router.delete("/uat/assignments/:id", authenticateToken, async (req, res) => {
  try {
    if (!["ba", "it", "it_member"].includes(req.user.role)) {
      return res.status(403).json({ message: "BA or IT role required" });
    }

    // Fetch before deleting so we can post the activity message
    const { rows: asgRows } = await pool.query(
      `SELECT ua.test_case_id, ua.stakeholder_id,
              tcd.request_id, tcd.content,
              u.name AS sh_name, u.email AS sh_email
       FROM uat_assignments ua
       JOIN test_case_documents tcd ON tcd.id = ua.tc_document_id
       JOIN users u ON u.id = ua.stakeholder_id
       WHERE ua.id = $1`,
      [req.params.id]
    );

    await pool.query("DELETE FROM uat_assignments WHERE id = $1", [req.params.id]);

    if (asgRows[0]) {
      const { request_id, content, test_case_id, sh_name, sh_email } = asgRows[0];
      const shName = sh_name || sh_email;
      const tcDef = (content?.test_cases ?? []).find(tc => tc.id === test_case_id);
      const tcName = tcDef?.name ?? test_case_id;
      await postSystemActivity(
        request_id,
        `🗑️ UAT assignment for "${tcName}" (${shName}) has been removed.`
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE uat assignment error:", err);
    res.status(500).json({ message: "Failed to remove assignment" });
  }
});

// PUT /api/testing/uat/assignments/:id — update assignment result (stakeholder or BA)
// Body: { status, remarks, manual_notes, test_mode }
router.put("/uat/assignments/:id", authenticateToken, async (req, res) => {
  try {
    const { status, remarks, manual_notes, test_mode } = req.body;
    const { rows } = await pool.query(
      `UPDATE uat_assignments
       SET status = COALESCE($1, status),
           remarks = COALESCE($2, remarks),
           manual_notes = COALESCE($3, manual_notes),
           test_mode = COALESCE($4, test_mode),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, remarks, manual_notes, test_mode, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Assignment not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT uat assignment error:", err);
    res.status(500).json({ message: "Failed to update assignment" });
  }
});

// PUT /api/testing/uat/:tcDocId/config — BA / IT sets pass threshold
router.put("/uat/:tcDocId/config", authenticateToken, async (req, res) => {
  try {
    if (!["ba", "it", "it_member"].includes(req.user.role)) {
      return res.status(403).json({ message: "BA or IT role required" });
    }
    const { pass_threshold } = req.body;
    if (typeof pass_threshold !== "number") {
      return res.status(400).json({ message: "pass_threshold (number) required" });
    }
    const doc = await getTcDoc(req.params.tcDocId);
    if (!doc) return res.status(404).json({ message: "Not found" });

    await pool.query(
      `INSERT INTO uat_config (tc_document_id, pass_threshold, configured_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (tc_document_id)
       DO UPDATE SET pass_threshold = EXCLUDED.pass_threshold,
                     configured_by = EXCLUDED.configured_by,
                     updated_at = NOW()`,
      [doc.id, pass_threshold, req.user.id]
    );
    res.json({ ok: true, pass_threshold });
  } catch (err) {
    console.error("PUT uat config error:", err);
    res.status(500).json({ message: "Failed to update config" });
  }
});

// POST /api/testing/uat/:tcDocId/submit-approval — submit for production approval
router.post("/uat/:tcDocId/submit-approval", authenticateToken, async (req, res) => {
  try {
    const doc = await getTcDoc(req.params.tcDocId);
    if (!doc) return res.status(404).json({ message: "Not found" });

    // Calculate current pass rate
    const { rows: assignments } = await pool.query(
      "SELECT status FROM uat_assignments WHERE tc_document_id = $1",
      [doc.id]
    );
    if (!assignments.length) {
      return res.status(400).json({ message: "No UAT assignments found" });
    }
    const passed = assignments.filter(a => a.status === "Pass").length;
    const passRate = Math.round((passed / assignments.length) * 100);

    const { rows: cfgRows } = await pool.query(
      "SELECT pass_threshold FROM uat_config WHERE tc_document_id = $1",
      [doc.id]
    );
    const threshold = cfgRows[0]?.pass_threshold ?? 80;

    if (passRate < threshold) {
      return res.status(400).json({
        message: `Pass rate ${passRate}% is below threshold ${threshold}%`
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO approval_requests (tc_document_id, request_id, pass_rate, submitted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tc_document_id) DO UPDATE
         SET pass_rate = EXCLUDED.pass_rate, status = 'Pending',
             submitted_by = EXCLUDED.submitted_by, submitted_at = NOW(),
             reviewed_by = NULL, reviewed_at = NULL, comment = NULL
       RETURNING *`,
      [doc.id, doc.request_id, passRate, req.user.id]
    );

    await pool.query(
      "UPDATE requests SET status = 'Pending Approval', updated_at = NOW() WHERE id = $1",
      [doc.request_id]
    );

    await postSystemActivity(
      doc.request_id,
      `📤 UAT approval request submitted with a ${passRate}% pass rate. Awaiting BA review for production deployment sign-off.`
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST submit-approval error:", err);
    res.status(500).json({ message: "Failed to submit approval" });
  }
});

// GET /api/testing/approvals — list all approval requests (IT manager / BA)
router.get("/approvals", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ar.id, ar.tc_document_id, ar.request_id, ar.pass_rate, ar.status,
              ar.submitted_at, ar.reviewed_at, ar.comment,
              r.title AS request_title, r.req_number,
              sub.name AS submitted_by_name, rev.name AS reviewed_by_name,
              tcd.doc_id AS tc_doc_id
       FROM approval_requests ar
       JOIN requests r ON r.id = ar.request_id
       JOIN test_case_documents tcd ON tcd.id = ar.tc_document_id
       LEFT JOIN users sub ON sub.id = ar.submitted_by
       LEFT JOIN users rev ON rev.id = ar.reviewed_by
       ORDER BY ar.submitted_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET approvals error:", err);
    res.status(500).json({ message: "Failed to fetch approvals" });
  }
});

// PUT /api/testing/approvals/:id — IT manager approves or rejects
// Body: { action: 'approve'|'reject', comment }
router.put("/approvals/:id", authenticateToken, async (req, res) => {
  try {
    if (!["it", "ba"].includes(req.user.role)) {
      return res.status(403).json({ message: "IT or BA role required" });
    }
    const { action, comment } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    }

    const status = action === "approve" ? "Approved" : "Rejected";
    const { rows } = await pool.query(
      `UPDATE approval_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), comment = $3
       WHERE id = $4
       RETURNING request_id`,
      [status, req.user.id, comment ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Approval request not found" });

    const { request_id } = rows[0];

    if (action === "approve") {
      await pool.query(
        "UPDATE requests SET status = 'Approved for Deployment', updated_at = NOW() WHERE id = $1",
        [request_id]
      );
      await postSystemActivity(
        request_id,
        `✅ UAT testing has been approved for production deployment${comment ? ` — "${comment}"` : ""}. IT can now proceed with the production release.`
      );
    } else {
      await pool.query(
        "UPDATE requests SET status = 'UAT Testing', updated_at = NOW() WHERE id = $1",
        [request_id]
      );
      await postSystemActivity(
        request_id,
        `❌ UAT approval has been rejected — testing must continue${comment ? `: "${comment}"` : ""}. Please address the issues and resubmit.`
      );
    }

    res.json({ ok: true, status });
  } catch (err) {
    console.error("PUT approval error:", err);
    res.status(500).json({ message: "Failed to update approval" });
  }
});


// GET /api/testing/stakeholders — list stakeholder users (for BA/IT assignment UI)
router.get("/stakeholders", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE role = 'stakeholder' ORDER BY name, email"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET stakeholders error:", err);
    res.status(500).json({ message: "Failed to fetch stakeholders" });
  }
});

export default router;
