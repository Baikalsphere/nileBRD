import pool from "../config/db.js";
import bcryptjs from "bcryptjs";

export async function getAllUsers() {
  try {
    const result = await pool.query(
      "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    return result.rows;
  } catch (error) {
    throw new Error("Failed to fetch users");
  }
}

export async function createAdminUser(email, password, role) {
  try {
    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("Email already exists");
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, role, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, role, created_at",
      [email, hashedPassword, role]
    );

    const user = result.rows[0];

    // Log the action
    await pool.query(
      "INSERT INTO auth_logs (user_id, action) VALUES ($1, $2)",
      [user.id, "ADMIN_CREATE"]
    );

    return { user };
  } catch (error) {
    throw error;
  }
}
