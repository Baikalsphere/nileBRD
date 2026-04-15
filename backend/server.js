import "dotenv/config.js";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import requestRoutes from "./routes/requests.js";
import discussionRoutes from "./routes/discussions.js";
import streamRoutes from "./routes/stream.js";
import pool from "./config/db.js";
import { initChat } from "./socket/chat.js";
import { runMigrations } from "./migrations/run.js";

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:3000",
  /^https:\/\/[^.]+\.datasturdy\.com$/,
  /^https:\/\/nile-brd.*\.vercel\.app$/,
];

// Socket.io — attached to the same HTTP server
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true },
});
initChat(io);

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/discussions", discussionRoutes);
app.use("/api/stream", streamRoutes);

// Health check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Database connection failed" });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error", error: err.message });
});

// Run migrations before accepting traffic
runMigrations().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`🔗 Frontend URL: ${FRONTEND_URL}`);
  });
}).catch((err) => {
  console.error("❌ Failed to run migrations on startup:", err);
  process.exit(1);
});
