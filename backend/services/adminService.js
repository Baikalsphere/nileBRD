import pool from "../config/db.js";
import bcryptjs from "bcryptjs";

export async function getAllUsers() {
  try {
    const result = await pool.query(
      "SELECT id, email, role, name, is_it_manager, created_at FROM users ORDER BY created_at DESC"
    );
    return result.rows;
  } catch (error) {
    throw new Error("Failed to fetch users");
  }
}

export async function createAdminUser(email, password, role, name = null) {
  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("Email already exists");
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password_hash, role, name, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, role, name, created_at",
      [email, hashedPassword, role, name || null]
    );

    const user = result.rows[0];

    await pool.query(
      "INSERT INTO auth_logs (user_id, action) VALUES ($1, $2)",
      [user.id, "ADMIN_CREATE"]
    );

    return { user };
  } catch (error) {
    throw error;
  }
}

export async function setItManager(userId) {
  // Clear existing IT manager first
  await pool.query("UPDATE users SET is_it_manager = FALSE WHERE is_it_manager = TRUE");
  const result = await pool.query(
    "UPDATE users SET is_it_manager = TRUE WHERE id = $1 AND role = 'it' RETURNING id, email, role, name, is_it_manager, created_at",
    [userId]
  );
  if (!result.rows.length) throw new Error("User not found or not an IT user");
  return result.rows[0];
}

export async function deleteUser(userId) {
  // Delete auth_logs first (no ON DELETE CASCADE defined)
  await pool.query("DELETE FROM auth_logs WHERE user_id = $1", [userId]);
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id, email",
    [userId]
  );
  if (!result.rows.length) throw new Error("User not found");
  return result.rows[0];
}

export async function updateUserName(id, name) {
  try {
    const result = await pool.query(
      "UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role, name, created_at",
      [name || null, id]
    );
    if (result.rows.length === 0) {
      throw new Error("User not found");
    }
    return result.rows[0];
  } catch (error) {
    throw error;
  }
}
