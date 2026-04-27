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

// ─── Text quality helpers ─────────────────────────────────────────────────────

/**
 * Clean extracted text: normalize encodings, remove garbage chars, preserve structure.
 * Unlike a simple /\s+/ collapse, this keeps newlines so paragraph structure survives.
 */
function cleanExtractedText(text) {
  return text
    .replace(/\x00/g, "")                               // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ") // control chars (keep \t \n \r)
    // Common Unicode → ASCII normalisation
    .replace(/ﬀ/g, "ff").replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl")
    .replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/–/g, "-").replace(/—/g, "--")
    .replace(/•|‣|◦|⁃/g, "*")        // bullets
    .replace(/…/g, "...").replace(/ /g, " ")   // ellipsis, nbsp
    // Strip chars outside printable ASCII + Latin Extended
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ɏ]/g, " ")
    // Collapse horizontal whitespace only (preserve \n)
    .replace(/[ \t]+/g, " ")
    // Normalise line endings and collapse excess blank lines
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Ratio of readable prose characters (letters, digits, punctuation, spaces).
 * A score below ~0.55 indicates garbage encoding rather than real text.
 */
function readabilityScore(text) {
  if (!text || text.length < 20) return 0;
  const readable = (text.match(/[a-zA-Z0-9 \t\n.,;:!?'"()\-]/g) || []).length;
  return readable / text.length;
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

async function extractPdfText(buffer) {
  let pdfParseText = "";
  let pdfPages = null;

  try {
    const pdfParse = require("pdf-parse/lib/pdf-parse.js");
    const data = await pdfParse(buffer, { max: 0 }); // max:0 = all pages
    pdfParseText = cleanExtractedText(data.text || "");
    pdfPages = data.numpages || null;
  } catch {
    // pdf-parse failed — will try regex fallback
  }

  // Use pdf-parse result only if it passes the readability bar
  if (pdfParseText.length > 100 && readabilityScore(pdfParseText) >= 0.55) {
    return { text: pdfParseText, pages: pdfPages };
  }

  // ── Regex fallback: extract strings directly from PDF content streams ──────
  const raw = buffer.toString("latin1");
  const chunks = [];

  // Walk each BT…ET text block (PDF text operators)
  const btEt = /BT\s*([\s\S]*?)\s*ET/g;
  let m;
  while ((m = btEt.exec(raw)) !== null) {
    const block = m[1];

    // Literal strings: (text)
    const litRe = /\(([^)]{1,400})\)/g;
    let sm;
    while ((sm = litRe.exec(block)) !== null) {
      const t = sm[1]
        .replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ")
        .replace(/\\(.)/g, "$1")                // unescape \x sequences
        .replace(/[^\x20-\x7E\n]/g, "")
        .trim();
      if (t.length > 2) chunks.push(t);
    }

    // Hex strings: <4865 6C6C6F> — common when font encoding breaks literals
    const hexRe = /<([0-9A-Fa-f\s]{4,})>/g;
    let hm;
    while ((hm = hexRe.exec(block)) !== null) {
      const hex = hm[1].replace(/\s/g, "");
      let decoded = "";
      for (let i = 0; i + 1 < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (code >= 0x20 && code <= 0x7E) decoded += String.fromCharCode(code);
      }
      if (decoded.length > 2) chunks.push(decoded);
    }
  }

  // Last resort: scan for long ASCII runs anywhere in the file
  if (chunks.length < 10) {
    const asciiRe = /[ -~]{8,}/g;
    let am;
    const seen = new Set();
    while ((am = asciiRe.exec(raw)) !== null) {
      const t = am[0].trim();
      if (t.length > 10 && !seen.has(t) && readabilityScore(t) > 0.7) {
        seen.add(t);
        chunks.push(t);
      }
    }
  }

  const fallbackText = chunks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: fallbackText, pages: pdfPages };
}

// ─── DOCX extraction ──────────────────────────────────────────────────────────

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function extractDocxText(buffer) {
  // Read up to 20MB of raw XML (covers very large DOCX files)
  const raw = buffer.toString("utf-8", 0, Math.min(buffer.length, 20 * 1024 * 1024));
  const paragraphs = [];
  let i = 0;

  // Walk paragraph by paragraph to preserve newline structure
  while (i < raw.length) {
    const pStart = raw.indexOf("<w:p", i);
    if (pStart === -1) break;

    const pEnd = raw.indexOf("</w:p>", pStart);
    if (pEnd === -1) break;

    const paraXml = raw.slice(pStart, pEnd + 6);
    const parts = [];
    const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = textRe.exec(paraXml)) !== null) {
      const t = decodeXmlEntities(m[1]).trim();
      if (t) parts.push(t);
    }

    if (parts.length) paragraphs.push(parts.join(" "));

    i = pEnd + 6;
  }

  return paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
        text = cleanExtractedText(buf.toString("utf-8"));
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
