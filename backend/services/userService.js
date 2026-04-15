import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../middleware/auth.js";

export const signup = async (email, password, role) => {
  try {
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role",
      [email, hashedPassword, role]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    await pool.query(
      "INSERT INTO auth_logs (user_id, action) VALUES ($1, $2)",
      [user.id, "signup"]
    );

    return { user, token };
  } catch (error) {
    const msg = error.message || error.errors?.[0]?.message || String(error);
    console.error("[signup] error detail:", msg, error);
    throw new Error(msg);
  }
};

export const login = async (email, password) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    const token = generateToken(user);

    // auth_logs insert is best-effort — don't let a logging failure break login
    try {
      await pool.query(
        "INSERT INTO auth_logs (user_id, action) VALUES ($1, $2)",
        [user.id, "login"]
      );
    } catch (logErr) {
      console.warn("[login] auth_logs insert failed (non-fatal):", logErr.message);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  } catch (error) {
    const msg = error.message || error.errors?.[0]?.message || String(error);
    console.error("[login] error detail:", msg, error);
    throw new Error(msg);
  }
};

export const getUserById = async (id) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role, name, created_at FROM users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error("User not found");
    }

    return result.rows[0];
  } catch (error) {
    const msg = error.message || error.errors?.[0]?.message || String(error);
    throw new Error(msg);
  }
};
