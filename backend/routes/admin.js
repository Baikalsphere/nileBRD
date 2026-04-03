import express from "express";
import { getAllUsers, createAdminUser, updateUserName, setItManager, deleteUser } from "../services/adminService.js";
import { 
  authenticateAdmin, 
  adminLoginLimiter, 
  generateAdminToken,
  verifyAdminPassword 
} from "../middleware/adminAuth.js";
import { logAdminLogin, logAdminAction, getAdminAuditLogs } from "../services/auditService.js";

const router = express.Router();

// Admin login endpoint - no middleware, but rate limited
router.post("/login", adminLoginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Validate input
    if (!password) {
      await logAdminLogin(null, false, clientIp);
      return res.status(400).json({ message: "Password required" });
    }

    // Verify admin password
    if (!verifyAdminPassword(password)) {
      await logAdminLogin(null, false, clientIp);
      return res.status(401).json({ message: "Invalid admin password" });
    }

    // Generate token with a fixed admin ID (you could store admin users in DB if needed)
    const adminToken = generateAdminToken("admin", "admin@system.local");
    
    // Log successful login
    await logAdminLogin("admin", true, clientIp);

    res.json({
      message: "Admin login successful",
      token: adminToken,
      expiresIn: "8h",
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Login error" });
  }
});

// Verify admin token endpoint
router.post("/verify", authenticateAdmin, async (req, res) => {
  try {
    res.json({
      message: "Token is valid",
      admin: req.admin,
    });
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(500).json({ message: "Verification error" });
  }
});

// Get all users - protected by admin authentication
router.get("/users", authenticateAdmin, async (req, res) => {
  try {
    await logAdminAction(req.admin.id, "VIEW_USERS_LIST");
    const users = await getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Create user (admin endpoint) - protected by admin authentication
router.post("/create-user", authenticateAdmin, async (req, res) => {
  try {
    const { email, password, role, name } = req.body;

    // Validate input
    if (!email || !password || !role) {
      await logAdminAction(req.admin.id, "CREATE_USER_FAILED", { reason: "Missing fields", email });
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["stakeholder", "ba", "it"].includes(role)) {
      await logAdminAction(req.admin.id, "CREATE_USER_FAILED", { reason: "Invalid role", email, role });
      return res.status(400).json({ message: "Invalid role" });
    }

    if (password.length < 6) {
      await logAdminAction(req.admin.id, "CREATE_USER_FAILED", { reason: "Weak password", email });
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const result = await createAdminUser(email, password, role, name || null);

    // Log successful user creation
    await logAdminAction(req.admin.id, "CREATE_USER", { email, role, name: name || null });

    res.status(201).json({
      message: "User created successfully",
      user: result.user,
    });
  } catch (error) {
    console.error("Create user error:", error);
    await logAdminAction(req.admin.id, "CREATE_USER_ERROR", { error: error.message });
    res.status(400).json({ message: error.message });
  }
});

// Update user display name - protected by admin authentication
router.patch("/users/:id/name", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const user = await updateUserName(parseInt(id, 10), name);
    await logAdminAction(req.admin.id, "UPDATE_USER_NAME", { userId: id, name });

    res.json({ message: "Name updated", user });
  } catch (error) {
    console.error("Update name error:", error);
    res.status(error.message === "User not found" ? 404 : 500).json({ message: error.message });
  }
});

// Set IT Manager — only one IT user can be IT Manager at a time
router.patch("/users/:id/it-manager", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await setItManager(parseInt(id, 10));
    await logAdminAction(req.admin.id, "SET_IT_MANAGER", { userId: id, email: user.email });
    res.json({ message: "IT Manager set", user });
  } catch (error) {
    console.error("Set IT manager error:", error);
    res.status(error.message === "User not found or not an IT user" ? 400 : 500).json({ message: error.message });
  }
});

// Delete user — removes user and all related data
router.delete("/users/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await deleteUser(parseInt(id, 10));
    await logAdminAction(req.admin.id, "DELETE_USER", { userId: id, email: user.email });
    res.json({ message: "User deleted", user });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(error.message === "User not found" ? 404 : 500).json({ message: error.message });
  }
});

// Get audit logs - protected by admin authentication
router.get("/audit-logs", authenticateAdmin, async (req, res) => {
  try {
    const logs = await getAdminAuditLogs(100);
    res.json({ logs });
  } catch (error) {
    console.error("Get audit logs error:", error);
    res.status(500).json({ message: "Error fetching audit logs" });
  }
});

// Logout endpoint (optional, for frontend to notify backend)
router.post("/logout", authenticateAdmin, async (req, res) => {
  try {
    await logAdminAction(req.admin.id, "LOGOUT");
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout error" });
  }
});

export default router;
