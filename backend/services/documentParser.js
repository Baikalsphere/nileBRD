/**
 * documentParser.js — Full-text extraction from request attachments stored on disk.
 *
 * Supports: PDF (via pdf-parse), DOCX (XML extraction), plain text, CSV.
 * No character limit — full document text is returned for the document intelligence agent.
 *
 * Output shape per document:
 *   { name, mime, sizeKb, pagesEstimated, text, sections }
 */

import { createRequire } from "module";
import { promises as fs } from "fs";
import pool from "../config/db.js";
import { getFilePath } from "../storage.js";

const require = createRequire(import.meta.url);

// ─── Section detection ────────────────────────────────────────────────────────

function detectSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let currentTitle = "Document";
  let currentLines = [];
  let charCount = 0;

  const isHeadingLine = (line, nextLine) => {
    const t = line.trim();
    if (!t || t.length > 120) return false;
    // Markdown headings: # Heading
    if (/^#{1,4}\s+\S/.test(t)) return true;
    // Numbered sections: "1. Title", "1.1 Section", "2.3.1 Sub-section"
    if (/^\d+(\.\d+){0,3}\s{1,4}[A-Z]/.test(t)) return true;
    // ALL-CAPS heading (min 4 chars, no sentence structure)
    if (/^[A-Z][A-Z\s\-/]{3,60}$/.test(t) && !/\s{2}/.test(t)) return true;
    // Short title-case line followed by a blank line
    if (t.length < 80 && /^[A-Z]/.test(t) && (!nextLine || nextLine.trim() === "")) return true;
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";

    if (isHeadingLine(line, nextLine) && charCount > 300) {
      sections.push({
        title: currentTitle,
        content: currentLines.join("\n").replace(/\s+\n/g, "\n").trim(),
      });
      currentTitle = line.trim()
        .replace(/^#{1,4}\s+/, "")
        .replace(/^\d+(\.\d+)*\s+/, "");
      currentLines = [];
      charCount = 0;
    } else {
      currentLines.push(line);
      charCount += line.length;
    }
  }

  if (currentLines.length) {
    sections.push({
      title: currentTitle,
      content: currentLines.join("\n").replace(/\s+\n/g, "\n").trim(),
    });
  }

  return sections.filter((s) => s.content.length > 80);
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

async function extractPdfText(buffer) {
  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer, { max: 0 }); // max:0 = all pages
    const text = (data.text || "").replace(/\s+/g, " ").trim();
    if (text.length > 50) return { text, pages: data.numpages || null };
  } catch {
    // pdf-parse failed — fall through to regex fallback
  }

  // Regex fallback: scan BT/ET operators for readable strings
  const raw = buffer.toString("latin1");
  const chunks = [];

  const btEt = /BT\s*([\s\S]*?)\s*ET/g;
  let m;
  while ((m = btEt.exec(raw)) !== null) {
    const strRe = /\(([^)]{1,300})\)/g;
    let sm;
    while ((sm = strRe.exec(m[1])) !== null) {
      const t = sm[1]
        .replace(/\\n/g, " ")
        .replace(/\\r/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .trim();
      if (t.length > 3) chunks.push(t);
    }
  }

  if (chunks.length < 5) {
    const asciiRe = /[ -~]{6,}/g;
    let am;
    const seen = new Set();
    while ((am = asciiRe.exec(raw)) !== null) {
      const t = am[0].trim();
      if (t.length > 8 && !seen.has(t)) {
        seen.add(t);
        chunks.push(t);
      }
    }
  }

  const text = chunks.join(" ").replace(/\s+/g, " ").trim();
  return { text, pages: null };
}

// ─── DOCX extraction ──────────────────────────────────────────────────────────

function extractDocxText(buffer) {
  // Read up to 20MB of raw XML (covers very large DOCX files)
  const raw = buffer.toString("utf-8", 0, Math.min(buffer.length, 20 * 1024 * 1024));
  const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const parts = [];
  let m;
  while ((m = textRe.exec(raw)) !== null) {
    const t = m[1]
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
    if (t.length > 1) parts.push(t);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all attachments for a request and return structured extraction results.
 * Returns null if the request has no attachments.
 *
 * Output: [{ name, mime, sizeKb, pagesEstimated, text, sections }]
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
    let pagesEstimated = null;
    const mime = (att.mimetype || "").toLowerCase();
    const name = att.original_name || "unknown";
    const sizeKb = Math.round((att.size || 0) / 1024);

    try {
      const buf = await fs.readFile(getFilePath(att.s3_key));

      if (mime.includes("text/plain") || name.endsWith(".txt") || name.endsWith(".csv")) {
        text = buf.toString("utf-8");
        pagesEstimated = Math.ceil(text.length / 2000);
      } else if (mime.includes("pdf") || name.endsWith(".pdf")) {
        const result = await extractPdfText(buf);
        text = result.text;
        pagesEstimated = result.pages ?? Math.ceil(text.length / 2000);
        if (!text) text = "[PDF content could not be extracted — only file name is available]";
      } else if (
        mime.includes("wordprocessingml") ||
        mime.includes("msword") ||
        name.endsWith(".docx") ||
        name.endsWith(".doc")
      ) {
        text = extractDocxText(buf);
        pagesEstimated = Math.ceil(text.length / 2000);
        if (!text) text = "[Word document content could not be extracted — only file name is available]";
      } else {
        text = "[Binary file — content not extracted]";
      }
    } catch (err) {
      text = `[Could not read attachment: ${err.message}]`;
    }

    const sections = text.length > 200 && !text.startsWith("[")
      ? detectSections(text)
      : [];

    results.push({ name, mime, sizeKb, pagesEstimated, text, sections });
  }

  return results;
}

/**
 * Format document context into a single string for injection into AI prompts.
 * Used as fallback when no structured document analysis is available.
 */
export function formatDocumentContext(docs) {
  if (!docs || !docs.length) return "";
  return docs
    .map((d, i) =>
      `--- Attached Document ${i + 1}: "${d.name}" (${d.mime || "unknown type"}, ${d.sizeKb}KB) ---\n${d.text}`
    )
    .join("\n\n");
}
