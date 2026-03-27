import pool from "../config/db.js";

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('stakeholder', 'ba', 'it')),
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add name column to existing users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Logs table for auditing
CREATE TABLE IF NOT EXISTS auth_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin audit logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on admin_id and timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_timestamp ON admin_audit_logs(timestamp DESC);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  req_number VARCHAR(20) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL,
  category VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'Submitted',
  assignment_mode VARCHAR(20) DEFAULT 'automatic',
  stakeholder_id INTEGER REFERENCES users(id),
  assigned_ba_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Request attachments table (stores S3/R2 object key, not file bytes)
CREATE TABLE IF NOT EXISTS request_attachments (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  mimetype VARCHAR(100),
  size INTEGER,
  s3_key VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing table: drop old bytea column, add s3_key if needed
ALTER TABLE request_attachments DROP COLUMN IF EXISTS data;
ALTER TABLE request_attachments ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500);

CREATE INDEX IF NOT EXISTS idx_requests_ba ON requests(assigned_ba_id);
CREATE INDEX IF NOT EXISTS idx_requests_stakeholder ON requests(stakeholder_id);

-- Real-time chat messages per request
CREATE TABLE IF NOT EXISTS request_messages (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id),
  message TEXT NOT NULL,
  reply_to_id INTEGER REFERENCES request_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_request ON request_messages(request_id, created_at);

-- Read receipts: track last-read position per user per request
CREATE TABLE IF NOT EXISTS request_read_receipts (
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts ON request_read_receipts(user_id, request_id);
`;

async function migrate() {
  try {
    console.log("🔄 Running migrations...");
    
    const statements = schema.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }
    
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
