import express from "express";
import { signup, login } from "../services/userService.js";
import { authenticateToken, generateToken } from "../middleware/auth.js";
import pool from "../config/db.js";

const router = express.Router();

// Ensure auth_provider column exists — runs once on startup, safe to call repeatedly
async function ensureAuthProviderColumn() {
  try {
    await pool.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local'`
    );
  } catch { /* column may already exist */ }
}
ensureAuthProviderColumn();

// Signup endpoint
router.post("/signup", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate input
    if (!email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["stakeholder", "ba", "it", "it_member"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const result = await signup(email, password, role);

    res.status(201).json({
      message: "User created successfully",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(400).json({ message: error.message });
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const result = await login(email, password);

    res.status(200).json({
      message: "Login successful",
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ message: error.message });
  }
});

// Azure AD SSO login — receives MSAL access token, verifies via Graph API, upserts user
router.post("/azure-login", async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ message: "Access token required" });

    // Verify token and fetch profile from Microsoft Graph
    const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!graphRes.ok) return res.status(401).json({ message: "Invalid Azure access token" });

    const profile = await graphRes.json();
    const email = (profile.mail || profile.userPrincipalName || "").toLowerCase().trim();
    const displayName = profile.displayName || profile.givenName || email.split("@")[0];

    if (!email) return res.status(400).json({ message: "Could not retrieve email from Azure profile" });

    // Find existing user or create as stakeholder
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    let user;

    if (existing.rows.length > 0) {
      // Update display name (if still blank) and mark auth_provider
      await pool.query(
        `UPDATE users SET
           name = COALESCE(NULLIF(TRIM(name), ''), $1),
           auth_provider = 'azure'
         WHERE id = $2`,
        [displayName, existing.rows[0].id]
      );
      user = { ...existing.rows[0], name: existing.rows[0].name || displayName };
    } else {
      const ins = await pool.query(
        `INSERT INTO users (email, password_hash, role, name, auth_provider)
         VALUES ($1, $2, 'stakeholder', $3, 'azure')
         RETURNING id, email, role, name`,
        [email, "__azure_sso__", displayName]
      );
      user = ins.rows[0];
    }

    const token = generateToken(user);

    await pool.query(
      "INSERT INTO auth_logs (user_id, action) VALUES ($1, 'azure_login')",
      [user.id]
    ).catch(() => {});

    return res.json({
      message: "Azure login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    console.error("[azure-login] error:", err);
    return res.status(500).json({ message: "Azure login failed. Please try again." });
  }
});

// Verify token endpoint
router.get("/verify", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
