/**
 * File Storage — Local disk implementation.
 *
 * Stores uploaded attachments in  backend/uploads/  and serves them via
 * a signed-token pattern so download URLs are time-limited.
 *
 * Drop-in replacement for the previous Supabase Storage client.
 * Same exported interface: uploadFile / getSignedDownloadUrl / deleteFile.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Root uploads directory — one level above config/
export const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// Ensure the directory exists at startup
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// In-memory signed URL registry  { token → { filePath, expiresAt } }
const _signedTokens = new Map();

// Evict expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, meta] of _signedTokens) {
    if (meta.expiresAt < now) _signedTokens.delete(token);
  }
}, 10 * 60 * 1000);

/**
 * Upload a file buffer to local disk.
 * Returns a storage key (relative path) that is stored in the DB.
 */
export async function uploadFile(buffer, filename, mimetype, requestId) {
  // Sanitise filename and make it unique
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key  = `requests/${requestId}/${Date.now()}-${safe}`;
  const dest = path.join(UPLOADS_DIR, key);

  // Create sub-directories if needed
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buffer);

  return key;
}

/**
 * Generate a signed download URL valid for 15 minutes.
 * The token is consumed by GET /api/requests/attachment/:id
 * which reads the key from the DB and calls resolveSignedToken().
 */
export function generateSignedToken(key, ttlSeconds = 900) {
  const token     = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + ttlSeconds * 1000;
  _signedTokens.set(token, { key, expiresAt });
  return token;
}

/**
 * Resolve a signed token → storage key, or null if expired/unknown.
 */
export function resolveSignedToken(token) {
  const entry = _signedTokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { _signedTokens.delete(token); return null; }
  return entry.key;
}

/**
 * Return the absolute filesystem path for a given storage key.
 */
export function keyToAbsPath(key) {
  return path.join(UPLOADS_DIR, key);
}

/**
 * Compat shim: getSignedDownloadUrl — called by the attachment download route.
 * Returns a backend-relative URL that the route handler will resolve.
 * Format: /api/requests/download?token=<token>
 */
export async function getSignedDownloadUrl(key) {
  const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`;
  const token = generateSignedToken(key);
  return `${BACKEND_URL}/api/requests/download?token=${token}`;
}

/**
 * Delete a file from local disk (used for rollback on DB failures).
 */
export async function deleteFile(key) {
  const fullPath = keyToAbsPath(key);
  try { fs.unlinkSync(fullPath); } catch { /* ignore if already gone */ }
}
