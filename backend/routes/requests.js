import express from "express";
import multer from "multer";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/requests/ba-list — list all BA users (any authenticated user)
router.get("/ba-list", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, name FROM users WHERE role = 'ba' ORDER BY name, email"
    );
    res.json({ bas: result.rows });
  } catch (error) {
    console.error("BA list error:", error);
    res.status(500).json({ message: "Error fetching BA list" });
  }
});

// POST /api/requests — submit a new request (stakeholder)
router.post("/", authenticateToken, upload.array("attachments", 10), async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, description, priority, category, assignment_mode, assigned_ba_id } = req.body;

    if (!title || !description || !priority || !category) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await client.query("BEGIN");

    // Generate req number
    const countResult = await client.query("SELECT COUNT(*) FROM requests");
    const reqNumber = `REQ-${1100 + parseInt(countResult.rows[0].count) + 1}`;

    // Resolve BA assignment
    let baId = null;
    if (assignment_mode === "manual" && assigned_ba_id) {
      baId = parseInt(assigned_ba_id);
    } else if (assignment_mode === "automatic") {
      // Pick BA with fewest assigned requests
      const autoResult = await client.query(`
        SELECT u.id FROM users u
        LEFT JOIN requests r ON r.assigned_ba_id = u.id AND r.status != 'Closed'
        WHERE u.role = 'ba'
        GROUP BY u.id
        ORDER BY COUNT(r.id) ASC
        LIMIT 1
      `);
      if (autoResult.rows.length > 0) baId = autoResult.rows[0].id;
    }

    const reqResult = await client.query(
      `INSERT INTO requests (req_number, title, description, priority, category, assignment_mode, stakeholder_id, assigned_ba_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Submitted')
       RETURNING id, req_number, title, description, priority, category, status, assignment_mode, assigned_ba_id, created_at`,
      [reqNumber, title, description, priority, category, assignment_mode || "automatic", req.user.id, baId]
    );

    const request = reqResult.rows[0];

    // Store attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await client.query(
          "INSERT INTO request_attachments (request_id, original_name, mimetype, size, data) VALUES ($1,$2,$3,$4,$5)",
          [request.id, file.originalname, file.mimetype, file.size, file.buffer]
        );
      }
    }

    await client.query("COMMIT");

    // Fetch assigned BA name for response
    let assignedBa = null;
    if (baId) {
      const baResult = await pool.query("SELECT id, email, name FROM users WHERE id = $1", [baId]);
      if (baResult.rows.length > 0) assignedBa = baResult.rows[0];
    }

    res.status(201).json({ message: "Request submitted", request, assignedBa });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Submit request error:", error);
    res.status(500).json({ message: "Error submitting request" });
  } finally {
    client.release();
  }
});

// GET /api/requests/assigned — requests assigned to the logged-in BA
router.get("/assigned", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "ba") {
      return res.status(403).json({ message: "Only BA users can access assigned requests" });
    }

    const result = await pool.query(
      `SELECT r.id, r.req_number, r.title, r.description, r.priority, r.category,
              r.status, r.assignment_mode, r.created_at,
              u.email AS stakeholder_email, u.name AS stakeholder_name,
              COALESCE(
                json_agg(
                  json_build_object('id', a.id, 'original_name', a.original_name, 'mimetype', a.mimetype, 'size', a.size)
                ) FILTER (WHERE a.id IS NOT NULL),
                '[]'
              ) AS attachments
       FROM requests r
       JOIN users u ON u.id = r.stakeholder_id
       LEFT JOIN request_attachments a ON a.request_id = r.id
       WHERE r.assigned_ba_id = $1
       GROUP BY r.id, u.email, u.name
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error("Assigned requests error:", error);
    res.status(500).json({ message: "Error fetching assigned requests" });
  }
});

// GET /api/requests/attachment/:id — download a file (any authenticated user)
router.get("/attachment/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT original_name, mimetype, size, data FROM request_attachments WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const file = result.rows[0];
    res.setHeader("Content-Type", file.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${file.original_name}"`);
    res.setHeader("Content-Length", file.size);
    res.send(file.data);
  } catch (error) {
    console.error("Download attachment error:", error);
    res.status(500).json({ message: "Error downloading attachment" });
  }
});

export default router;
