/**
 * documentParser.js — Reads and extracts text from request attachments stored on disk.
 *
 * Supports: PDF (via pdf-parse), DOCX (XML extraction), plain text, CSV.
 * All other formats return filename + size metadata so they still appear in the BRD context.
 *
 * Text limit: 15 000 chars per document (enough for a full spec doc to be useful).
 */

import { createRequire } from "module";
import { promises as fs } from "fs";
import pool from "../config/db.js";
import { getFilePath } from "../storage.js";

const require = createRequire(import.meta.url);

const TEXT_LIMIT = 15000;

/**
 * PDF text extraction using pdf-parse.
 * Falls back to regex scanning if pdf-parse is unavailable or fails on a specific file.
 */
async function extractPdfText(buffer) {
  try {
    // Use lib/pdf-parse directly to avoid the test-file require side-effect
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer, { max: 0 }); // max:0 = all pages
    const text = (data.text || "").replace(/\s+/g, " ").trim();
    if (text.length > 50) return text.slice(0, TEXT_LIMIT);
  } catch (parseErr) {
    // pdf-parse failed — fall through to regex fallback
  }

  // Regex fallback: scan for readable strings between BT/ET operators
  const raw = buffer.toString("latin1");
  const chunks = [];

  const btEt = /BT\s*([\s\S]*?)\s*ET/g;
  let m;
  while ((m = btEt.exec(raw)) !== null) {
    const strRe = /\(([^)]{1,300})\)/g;
    let sm;
    while ((sm = strRe.exec(m[1])) !== null) {
      const t = sm[1].replace(/\\n/g, " ").replace(/\\r/g, "").replace(/[^\x20-\x7E]/g, "").trim();
      if (t.length > 3) chunks.push(t);
    }
  }

  if (chunks.length < 5) {
    const asciiRe = /[ -~]{6,}/g;
    let am;
    const seen = new Set();
    while ((am = asciiRe.exec(raw)) !== null) {
      const t = am[0].trim();
      if (t.length > 8 && !seen.has(t)) { seen.add(t); chunks.push(t); }
    }
  }

  const text = chunks.join(" ").replace(/\s+/g, " ").trim();
  return text.slice(0, TEXT_LIMIT) || "";
}

/**
 * DOCX text extraction by scanning word/document.xml for <w:t> text runs.
 */
function extractDocxText(buffer) {
  const raw = buffer.toString("utf-8", 0, Math.min(buffer.length, 2 * 1024 * 1024));
  const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const parts = [];
  let m;
  while ((m = textRe.exec(raw)) !== null) {
    const t = m[1]
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .trim();
    if (t.length > 1) parts.push(t);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, TEXT_LIMIT);
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
      const buf = await fs.readFile(getFilePath(att.s3_key));

      if (mime.includes("text/plain") || name.endsWith(".txt") || name.endsWith(".csv")) {
        text = buf.toString("utf-8").slice(0, TEXT_LIMIT);
      } else if (mime.includes("pdf") || name.endsWith(".pdf")) {
        text = await extractPdfText(buf);
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
