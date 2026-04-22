/**
 * documentParser.js — Downloads and extracts text from request attachments stored in Supabase.
 *
 * Supports: plain text, PDF (best-effort ASCII extraction), DOCX (XML text extraction).
 * All other formats return filename + size metadata so they still appear in the BRD context.
 */

import pool from "../config/db.js";
import { getSignedDownloadUrl } from "../config/storage.js";

async function fetchBuffer(signedUrl) {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Best-effort text extraction from a PDF buffer.
 * Works for uncompressed / partially compressed PDFs by scanning for readable strings.
 */
function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const chunks = [];

  // Extract text between BT (begin text) and ET (end text) operators
  const btEt = /BT\s*([\s\S]*?)\s*ET/g;
  let m;
  while ((m = btEt.exec(raw)) !== null) {
    const block = m[1];
    // Pull out parenthesised strings: (hello world)
    const strRe = /\(([^)]{1,300})\)/g;
    let sm;
    while ((sm = strRe.exec(block)) !== null) {
      const t = sm[1].replace(/\\n/g, " ").replace(/\\r/g, "").replace(/[^\x20-\x7E]/g, "").trim();
      if (t.length > 3) chunks.push(t);
    }
  }

  // Fallback: extract any long ASCII runs
  if (chunks.length < 5) {
    const asciiRe = /[ -~]{6,}/g;
    let am;
    const seen = new Set();
    while ((am = asciiRe.exec(raw)) !== null) {
      const t = am[0].trim();
      if (t.length > 8 && !seen.has(t)) { seen.add(t); chunks.push(t); }
    }
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim().slice(0, 6000);
}

/**
 * Best-effort text extraction from a DOCX buffer (ZIP containing word/document.xml).
 * Node does not have a built-in ZIP parser, so we scan for XML text runs directly.
 */
function extractDocxText(buffer) {
  const raw = buffer.toString("utf-8", 0, buffer.length);
  // DOCX text lives in <w:t> elements
  const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const parts = [];
  let m;
  while ((m = textRe.exec(raw)) !== null) {
    const t = m[1].replace(/</g, "<").replace(/>/g, ">").replace(/&amp;/g, "&").trim();
    if (t.length > 1) parts.push(t);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 6000);
}

/**
 * Fetch all attachments for a request, download them, and return extracted text.
 * Returns null if the request has no attachments.
 */
export async function getRequestDocumentContext(requestId) {
  const { rows } = await pool.query(
    `SELECT id, original_name, mimetype, size, s3_key
     FROM request_attachments WHERE request_id = $1 ORDER BY created_at ASC`,
    [requestId]
  );
  if (!rows.length) return null;

  const results = [];

  for (const att of rows) {
    let text = "";
    const mime = (att.mimetype || "").toLowerCase();
    const name = att.original_name || "unknown";
    const sizeKb = Math.round((att.size || 0) / 1024);

    try {
      const url = await getSignedDownloadUrl(att.s3_key);
      const buf = await fetchBuffer(url);

      if (mime.includes("text/plain") || name.endsWith(".txt") || name.endsWith(".csv")) {
        text = buf.toString("utf-8").slice(0, 6000);
      } else if (mime.includes("pdf") || name.endsWith(".pdf")) {
        text = extractPdfText(buf);
        if (!text) text = "[PDF content could not be extracted — only file name is available]";
      } else if (
        mime.includes("wordprocessingml") ||
        mime.includes("msword") ||
        name.endsWith(".docx") ||
        name.endsWith(".doc")
      ) {
        text = extractDocxText(buf);
        if (!text) text = "[Word document content could not be extracted — only file name is available]";
      } else {
        text = `[Binary file — content not extracted]`;
      }
    } catch (err) {
      text = `[Could not download attachment: ${err.message}]`;
    }

    results.push({ name, mime, sizeKb, text });
  }

  return results;
}

/**
 * Format document context into a single string for injection into AI prompts.
 */
export function formatDocumentContext(docs) {
  if (!docs || !docs.length) return "";
  return docs
    .map((d, i) =>
      `--- Attached Document ${i + 1}: "${d.name}" (${d.mime || "unknown type"}, ${d.sizeKb}KB) ---\n${d.text}`
    )
    .join("\n\n");
}
