import express from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { postSystemActivity } from "../services/streamService.js";

const router = express.Router();

// ─── Deployments ─────────────────────────────────────────────────────────────

// GET /api/deployments/:requestId — list deployments for a request
router.get("/:requestId", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.environment, d.deployment_type, d.status, d.notes,
              d.deployed_at, d.created_at, d.updated_at,
              u.name AS deployed_by_name, tcd.doc_id AS tc_doc_id
       FROM deployments d
       LEFT JOIN users u ON u.id = d.deployed_by
       LEFT JOIN test_case_documents tcd ON tcd.id = d.tc_document_id
       WHERE d.request_id = $1
       ORDER BY CASE d.environment WHEN 'SIT' THEN 1 WHEN 'UAT' THEN 2 WHEN 'Production' THEN 3 END`,
      [req.params.requestId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET deployments error:", err);
    res.status(500).json({ message: "Failed to fetch deployments" });
  }
});

// POST /api/deployments — create or update a deployment record
// Body: { request_id, tc_document_id, environment, deployment_type, notes }
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (!["it", "it_member"].includes(req.user.role)) {
      return res.status(403).json({ message: "IT role required" });
    }
    const { request_id, tc_document_id, environment, deployment_type, notes } = req.body;
    if (!request_id || !environment) {
      return res.status(400).json({ message: "request_id and environment required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO deployments (request_id, tc_document_id, environment, deployment_type, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tc_document_id, environment) DO UPDATE
         SET deployment_type = EXCLUDED.deployment_type,
             notes = EXCLUDED.notes,
             updated_at = NOW()
       RETURNING *`,
      [request_id, tc_document_id, environment, deployment_type ?? "Full", notes ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST deployment error:", err);
    res.status(500).json({ message: "Failed to create deployment" });
  }
});

// PUT /api/deployments/:id — update deployment status
// Body: { status, notes, deployment_type }
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    if (!["it", "it_member"].includes(req.user.role)) {
      return res.status(403).json({ message: "IT role required" });
    }
    const { status, notes, deployment_type } = req.body;
    const isDeployed = status === "Deployed" || status === "Partial";

    const { rows } = await pool.query(
      `UPDATE deployments
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           deployment_type = COALESCE($3, deployment_type),
           deployed_by = CASE WHEN $1 IN ('Deployed','Partial') THEN $4 ELSE deployed_by END,
           deployed_at  = CASE WHEN $1 IN ('Deployed','Partial') AND deployed_at IS NULL THEN NOW() ELSE deployed_at END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, notes, deployment_type, req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Deployment not found" });

    // When Production is deployed → create production_release & update request status
    if (isDeployed && rows[0].environment === "Production") {
      await pool.query(
        `INSERT INTO production_releases (request_id, tc_document_id, deployment_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (request_id) DO UPDATE SET deployment_id = EXCLUDED.deployment_id, status = 'Under Observation'`,
        [rows[0].request_id, rows[0].tc_document_id, rows[0].id]
      );
      await pool.query(
        "UPDATE requests SET status = 'Under Observation', updated_at = NOW() WHERE id = $1",
        [rows[0].request_id]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("PUT deployment error:", err);
    res.status(500).json({ message: "Failed to update deployment" });
  }
});

// ─── Production Defects ───────────────────────────────────────────────────────

// GET /api/deployments/defects/:requestId
router.get("/defects/:requestId", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pd.id, pd.title, pd.description, pd.severity, pd.status,
              pd.remarks, pd.created_at, pd.updated_at,
              rep.name AS reported_by_name, rep.email AS reported_by_email,
              asgn.name AS assigned_to_name
       FROM production_defects pd
       LEFT JOIN users rep  ON rep.id  = pd.reported_by
       LEFT JOIN users asgn ON asgn.id = pd.assigned_to
       WHERE pd.request_id = $1
       ORDER BY pd.created_at DESC`,
      [req.params.requestId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET defects error:", err);
    res.status(500).json({ message: "Failed to fetch defects" });
  }
});

// POST /api/deployments/defects — report a new production defect
// Body: { request_id, deployment_id?, title, description, severity }
router.post("/defects", authenticateToken, async (req, res) => {
  try {
    const { request_id, deployment_id, title, description, severity } = req.body;
    if (!request_id || !title) {
      return res.status(400).json({ message: "request_id and title required" });
    }

    // Find the IT manager to auto-assign
    const { rows: itMgr } = await pool.query(
      "SELECT id FROM users WHERE role = 'it' AND is_it_manager = TRUE LIMIT 1"
    );

    const { rows } = await pool.query(
      `INSERT INTO production_defects
         (request_id, deployment_id, title, description, severity, reported_by, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        request_id,
        deployment_id ?? null,
        title,
        description ?? null,
        severity ?? "Medium",
        req.user.id,
        itMgr[0]?.id ?? null,
      ]
    );
    await postSystemActivity(
      request_id,
      `🐛 Production defect reported: "${title}" (${severity ?? "Medium"} severity). Assigned to IT Manager for investigation.`
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST defect error:", err);
    res.status(500).json({ message: "Failed to report defect" });
  }
});

// PUT /api/deployments/defects/:id — update defect status/remarks
// Body: { status, remarks, assigned_to }
router.put("/defects/:id", authenticateToken, async (req, res) => {
  try {
    const { status, remarks, assigned_to } = req.body;
    const { rows } = await pool.query(
      `UPDATE production_defects
       SET status      = COALESCE($1, status),
           remarks     = COALESCE($2, remarks),
           assigned_to = COALESCE($3, assigned_to),
           updated_at  = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, remarks, assigned_to, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Defect not found" });

    if (status) {
      const statusEmoji = { Resolved: "✅", Closed: "🔒", "In Progress": "🔧", Open: "🔴" }[status] ?? "🔧";
      await postSystemActivity(
        rows[0].request_id,
        `${statusEmoji} Production defect "${rows[0].title}" status updated to ${status}.${remarks ? ` Remarks: "${remarks}"` : ""}`
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("PUT defect error:", err);
    res.status(500).json({ message: "Failed to update defect" });
  }
});

// ─── Production Release ───────────────────────────────────────────────────────

// GET /api/deployments/release/:requestId
router.get("/release/:requestId", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pr.id, pr.status, pr.created_at, pr.marked_completed_at,
              u.name AS completed_by_name
       FROM production_releases pr
       LEFT JOIN users u ON u.id = pr.marked_completed_by
       WHERE pr.request_id = $1`,
      [req.params.requestId]
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    console.error("GET release error:", err);
    res.status(500).json({ message: "Failed to fetch release status" });
  }
});

// PUT /api/deployments/release/:requestId — BA marks as Production Release Completed
router.put("/release/:requestId", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") {
      return res.status(403).json({ message: "BA only" });
    }

    // Check all defects are resolved
    const { rows: openDefects } = await pool.query(
      `SELECT id FROM production_defects
       WHERE request_id = $1 AND status NOT IN ('Resolved','Closed')`,
      [req.params.requestId]
    );
    if (openDefects.length > 0) {
      return res.status(400).json({
        message: `${openDefects.length} unresolved defect(s) — close all defects before completing`
      });
    }

    const { rows } = await pool.query(
      `UPDATE production_releases
       SET status = 'Completed', marked_completed_by = $1, marked_completed_at = NOW()
       WHERE request_id = $2
       RETURNING *`,
      [req.user.id, req.params.requestId]
    );
    if (!rows.length) return res.status(404).json({ message: "No production release record found" });

    await pool.query(
      "UPDATE requests SET status = 'Production Release Completed', updated_at = NOW() WHERE id = $1",
      [req.params.requestId]
    );

    await postSystemActivity(
      req.params.requestId,
      `🎉 Production release has been marked as Completed. All defects have been resolved and this request is now fully closed.`
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("PUT release error:", err);
    res.status(500).json({ message: "Failed to complete release" });
  }
});

export default router;
