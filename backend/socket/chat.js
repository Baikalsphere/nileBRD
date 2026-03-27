import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

export function initChat(io) {
  // Auth middleware — verify JWT from socket handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return next(new Error("Invalid token"));
      socket.user = user; // { id, email, role }
      next();
    });
  });

  io.on("connection", (socket) => {
    const { id: userId, email, role } = socket.user;

    // Join a request's chat room
    socket.on("join-room", async ({ requestId }) => {
      try {
        // Stakeholders can join any active request; BAs only their assigned ones
        let accessQuery, accessValues;
        if (role === "stakeholder") {
          accessQuery = "SELECT id FROM requests WHERE id = $1 AND status != 'Closed'";
          accessValues = [requestId];
        } else {
          accessQuery = "SELECT id FROM requests WHERE id = $1 AND assigned_ba_id = $2";
          accessValues = [requestId, userId];
        }
        const access = await pool.query(accessQuery, accessValues);
        if (access.rows.length === 0) {
          socket.emit("error", { message: "Access denied to this request" });
          return;
        }
        socket.join(`request-${requestId}`);
      } catch (err) {
        console.error("join-room error:", err);
      }
    });

    // Leave a room
    socket.on("leave-room", ({ requestId }) => {
      socket.leave(`request-${requestId}`);
    });

    // Send a message
    socket.on("send-message", async ({ requestId, message, replyToId }) => {
      try {
        if (!message?.trim()) return;

        // Verify access — stakeholders can message on any active request
        let accessQuery, accessValues;
        if (role === "stakeholder") {
          accessQuery = "SELECT id FROM requests WHERE id = $1 AND status != 'Closed'";
          accessValues = [requestId];
        } else {
          accessQuery = "SELECT id FROM requests WHERE id = $1 AND assigned_ba_id = $2";
          accessValues = [requestId, userId];
        }
        const access = await pool.query(accessQuery, accessValues);
        if (access.rows.length === 0) return;

        // Persist message
        const result = await pool.query(
          `INSERT INTO request_messages (request_id, sender_id, message, reply_to_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, request_id, message, reply_to_id, created_at`,
          [requestId, userId, message.trim(), replyToId || null]
        );
        const saved = result.rows[0];

        // Fetch sender info + reply snapshot
        const userResult = await pool.query(
          "SELECT id, email, name, role FROM users WHERE id = $1",
          [userId]
        );
        const sender = userResult.rows[0];

        let replySnapshot = null;
        if (replyToId) {
          const replyResult = await pool.query(
            `SELECT rm.message AS reply_text, u.name AS reply_sender_name, u.email AS reply_sender_email
             FROM request_messages rm JOIN users u ON u.id = rm.sender_id
             WHERE rm.id = $1`,
            [replyToId]
          );
          if (replyResult.rows.length > 0) replySnapshot = replyResult.rows[0];
        }

        const payload = {
          id: saved.id,
          request_id: saved.request_id,
          message: saved.message,
          reply_to_id: saved.reply_to_id,
          created_at: saved.created_at,
          sender_id: sender.id,
          sender_email: sender.email,
          sender_name: sender.name,
          sender_role: sender.role,
          ...(replySnapshot || {}),
        };

        // Broadcast to everyone in the room (including sender)
        io.to(`request-${requestId}`).emit("new-message", payload);
      } catch (err) {
        console.error("send-message error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });
  });
}
