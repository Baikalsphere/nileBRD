import "dotenv/config.js";
import pkg from "pg";
const { Pool } = pkg;

const isLocal = (process.env.DATABASE_URL ?? "").includes("localhost") ||
                (process.env.DATABASE_URL ?? "").includes("@db:");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
