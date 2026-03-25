import "dotenv/config.js";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import pool from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Database connection failed" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error", error: err.message });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});
