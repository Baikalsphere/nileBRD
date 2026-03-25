import express from "express";
import { getAllUsers, createAdminUser } from "../services/adminService.js";

const router = express.Router();

// Get all users
router.get("/users", async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Create user (admin endpoint)
router.post("/create-user", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate input
    if (!email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["stakeholder", "ba", "it"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const result = await createAdminUser(email, password, role);

    res.status(201).json({
      message: "User created successfully",
      user: result.user,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(400).json({ message: error.message });
  }
});

export default router;
