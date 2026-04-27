import express from "express";
import { signup, login } from "../services/userService.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IS_PROD = process.env.NODE_ENV === "production";

function setAuthCookies(res, token, user) {
  // httpOnly cookie holds the JWT — not accessible from JS
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  // Non-httpOnly cookie holds display-only user info for client-side rendering
  const userMeta = Buffer.from(
    JSON.stringify({
      id: user.id,
      name: user.name ?? user.email,
      email: user.email,
      role: user.role,
    })
  ).toString("base64");

  res.cookie("user_meta", userMeta, {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

// Signup endpoint
router.post("/signup", async (req, res) => {
  try {
    const { email, password, role } = req.body;

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

// Login endpoint — sets httpOnly auth_token + user_meta cookies
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const result = await login(email, password);

    // Set cookies so the session works whether nginx routes to Express or Next.js
    setAuthCookies(res, result.token, result.user);

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

// Token endpoint — returns the JWT from the httpOnly cookie for client-side API calls
router.get("/token", (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  res.json({ token });
});

// Logout endpoint — clears auth cookies
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", { path: "/" });
  res.clearCookie("user_meta", { path: "/" });
  res.json({ message: "Logged out" });
});

// Verify token endpoint
router.get("/verify", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
