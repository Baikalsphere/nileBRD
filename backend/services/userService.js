import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../middleware/auth.js";

export const signup = async (email, password, role) => {
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("User already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role",
      [email, hashedPassword, role]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    // Log auth event
    await pool.query(
      "INSERT INTO auth_logs (user_id, action) VALUES ($1, $2)",
      [user.id, "signup"]
    );

    return { user, token };
  } catch (error) {
    throw new Error(error.message);
  }
};

export const login = async (email, password) => {
  try {
    // Find user
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = result.rows[0];

    // Compare passwords
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    // Generate token
    const token = generateToken(user);

    // Log auth event
    await pool.query(
      "INSERT INTO auth_logs (user_id, action) VALUES ($1, $2)",
      [user.id, "login"]
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    };
  } catch (error) {
    throw new Error(error.message);
  }
};

export const getUserById = async (id) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role, created_at FROM users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  } catch (error) {
    throw new Error(error.message);
  }
};
