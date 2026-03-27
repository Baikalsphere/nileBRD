import express from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

function buildRequestsQuery(userIdField, partnerField, partnerAlias) {
  return {
    text: `
      SELECT * FROM (
        SELECT
          r.id, r.req_number, r.title, r.priority, r.category, r.status,
          u.name  AS ${partnerAlias}_name,
          u.email AS ${partnerAlias}_email,
          (SELECT COUNT(*) FROM request_messages m WHERE m.request_id = r.id)::int AS message_count,
          (SELECT m2.message   FROM request_messages m2 WHERE m2.request_id = r.id ORDER BY m2.created_at DESC LIMIT 1) AS last_message,
          (SELECT m3.created_at FROM request_messages m3 WHERE m3.request_id = r.id ORDER BY m3.created_at DESC LIMIT 1) AS last_message_at
        FROM requests r
        LEFT JOIN users u ON u.id = r.${partnerField}
        WHERE r.${userIdField} = $1 AND r.status != 'Closed'
      ) sub
      ORDER BY COALESCE(last_message_at, (SELECT created_at FROM requests WHERE id = sub.id)) DESC
    `,
  };
}

// GET /api/discussions/requests
router.get("/requests", authenticateToken, async (req, res) => {
  try {
    let text, values;

    if (req.user.role === "stakeholder") {
      text = `
        SELECT * FROM (
          SELECT
            r.id, r.req_number, r.title, r.priority, r.category, r.status,
            ba.name  AS ba_name,
            ba.email AS ba_email,
            sh.name  AS stakeholder_name,
            sh.email AS stakeholder_email,
            (SELECT COUNT(*) FROM request_messages m  WHERE m.request_id  = r.id)::int AS message_count,
            (SELECT m2.message    FROM request_messages m2 WHERE m2.request_id = r.id ORDER BY m2.created_at DESC LIMIT 1) AS last_message,
            (SELECT m3.created_at FROM request_messages m3 WHERE m3.request_id = r.id ORDER BY m3.created_at DESC LIMIT 1) AS last_message_at,
            r.created_at AS req_created_at
          FROM requests r
          LEFT JOIN users ba ON ba.id = r.assigned_ba_id
          LEFT JOIN users sh ON sh.id = r.stakeholder_id
          WHERE r.status != 'Closed'
        ) sub
        ORDER BY COALESCE(sub.last_message_at, sub.req_created_at) DESC
      `;
      values = [];
    } else if (req.user.role === "ba") {
      text = `
        SELECT * FROM (
          SELECT
            r.id, r.req_number, r.title, r.priority, r.category, r.status,
            u.name  AS stakeholder_name,
            u.email AS stakeholder_email,
            (SELECT COUNT(*) FROM request_messages m  WHERE m.request_id  = r.id)::int AS message_count,
            (SELECT m2.message    FROM request_messages m2 WHERE m2.request_id = r.id ORDER BY m2.created_at DESC LIMIT 1) AS last_message,
            (SELECT m3.created_at FROM request_messages m3 WHERE m3.request_id = r.id ORDER BY m3.created_at DESC LIMIT 1) AS last_message_at,
            r.created_at AS req_created_at
          FROM requests r
          LEFT JOIN users u ON u.id = r.stakeholder_id
          WHERE r.assigned_ba_id = $1 AND r.status != 'Closed'
        ) sub
        ORDER BY COALESCE(sub.last_message_at, sub.req_created_at) DESC
      `;
      values = [req.user.id];
    } else {
      return res.json({ requests: [] });
    }

    const result = await pool.query({ text, values });
    res.json({ requests: result.rows });
  } catch (error) {
    console.error("Discussions requests error:", error);
    res.status(500).json({ message: "Error fetching requests", detail: error.message });
  }
});

// GET /api/discussions/messages/:requestId
router.get("/messages/:requestId", authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    // Stakeholders can access any request's messages; BAs only their assigned ones
    let accessQuery, accessValues;
    if (req.user.role === "stakeholder") {
      accessQuery = "SELECT id FROM requests WHERE id = $1 AND status != 'Closed'";
      accessValues = [requestId];
    } else {
      accessQuery = "SELECT id FROM requests WHERE id = $1 AND assigned_ba_id = $2";
      accessValues = [requestId, req.user.id];
    }
    const access = await pool.query(accessQuery, accessValues);
    if (access.rows.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await pool.query(
      `SELECT m.id, m.request_id, m.message, m.created_at, m.reply_to_id,
              u.id AS sender_id, u.email AS sender_email, u.name AS sender_name, u.role AS sender_role,
              rm.message AS reply_text,
              ru.name    AS reply_sender_name,
              ru.email   AS reply_sender_email
       FROM request_messages m
       JOIN  users u  ON u.id  = m.sender_id
       LEFT JOIN request_messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.sender_id
       WHERE m.request_id = $1
       ORDER BY m.created_at ASC
       LIMIT 100`,
      [requestId]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error("Fetch messages error:", error);
    res.status(500).json({ message: "Error fetching messages", detail: error.message });
  }
});

export default router;
