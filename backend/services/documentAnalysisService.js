/**
 * documentAnalysisService.js — Multi-stage document intelligence agent for BRD extraction.
 *
 * Transforms raw document text into structured BRD-ready context using Azure OpenAI.
 *
 * Pipeline:
 *   Stage 1 — If documents exceed the safe context window, chunk them into segments
 *   Stage 2 — Run parallel AI extraction per chunk (all BRD dimensions in one call per chunk)
 *   Stage 3 — Consolidation pass: deduplicate and merge all chunk extractions into one result
 *
 * The structured output is stored in document_analyses and consumed by every stage
 * of the BRD pipeline (completeness, scope, workflow, full BRD generation).
 */

import OpenAI from "openai";

const azureClient = new OpenAI({
  apiKey:         process.env.AZURE_OPENAI_API_KEY,
  baseURL:        `${(process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

// Characters per chunk — targets ~40K tokens per call, leaving headroom in the 128K window
const CHUNK_SIZE = 55000;
const CHUNK_OVERLAP = 2500;

const EXTRACTION_SYSTEM = `You are an expert Business Analyst performing comprehensive document intelligence extraction for enterprise requirements projects.

Your task is to extract EVERY piece of information from the provided documents that could inform a Business Requirements Document.

CRITICAL RULES:
1. Extract VERBATIM where precision matters — numbers, SLAs, dates, names, thresholds must be quoted exactly as they appear.
2. Be EXHAUSTIVE — a missing item here becomes a missing requirement in the BRD.
3. Err on the side of inclusion, not brevity.
4. Only extract what is ACTUALLY IN the document — never add your own knowledge.
5. Flag anything unclear or contradictory as an open question.
6. Distinguish between what the document STATES vs what it merely IMPLIES.`;

const CONSOLIDATION_SYSTEM = `You are a senior Business Analyst consolidating structured extractions from multiple sections of a large business document into a single comprehensive result.

CRITICAL RULES:
1. Merge ALL items from all chunks — never discard a requirement, risk, or stakeholder.
2. Deduplicate items that express the same thing — keep the most specific/complete version.
3. For string fields (problem_statement, current_state, desired_state), combine into one coherent paragraph.
4. If chunks conflict, include both perspectives with a brief note.
5. Preserve verbatim quotes and numbers exactly as extracted.
6. Use "Not specified in documents" only when NO chunk found the information.`;

// ─── Chunking helpers ─────────────────────────────────────────────────────────

function chunkDocumentText(docText) {
  if (docText.length <= CHUNK_SIZE) return [docText];

  const chunks = [];
  let pos = 0;
  while (pos < docText.length) {
    let end = Math.min(pos + CHUNK_SIZE, docText.length);
    // Prefer breaking at a paragraph boundary
    if (end < docText.length) {
      const nearPara = docText.lastIndexOf("\n\n", end);
      if (nearPara > pos + CHUNK_SIZE * 0.65) end = nearPara;
    }
    chunks.push(docText.slice(pos, end));
    if (end === docText.length) break;
    pos = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// ─── Extraction schema (shared between extraction and consolidation prompts) ──

const EXTRACTION_SCHEMA =
  `{\n` +
  `  "document_types": ["<classify each doc: Requirements Spec | Process Document | Policy Document | Data Specification | Technical Spec | User Manual | Report | Meeting Notes | Other>"],\n` +
  `  "document_summary": "<2-3 sentence plain-English summary of what this content describes — written for a BA who has not read it>",\n` +
  `  "relevance_score": <integer 0-100 — how relevant this content is to the stated request/problem>,\n` +
  `  "problem_statement_in_doc": "<the core business problem or opportunity as described — quote directly where possible>",\n` +
  `  "current_state": "<description of the as-is situation — what exists today>",\n` +
  `  "desired_state": "<description of the to-be state or expected outcomes>",\n` +
  `  "key_requirements": [\n` +
  `    {\n` +
  `      "requirement": "<requirement text — be specific, not vague>",\n` +
  `      "type": "<Functional | Non-Functional | Business Rule | Data | Integration | Compliance | Constraint>",\n` +
  `      "priority_hint": "<Must Have | Should Have | Could Have | Won't Have — only if mentioned in doc>",\n` +
  `      "verbatim_source": "<exact quote or close paraphrase from the document>"\n` +
  `    }\n` +
  `  ],\n` +
  `  "business_rules": [\n` +
  `    { "rule": "<formal rule statement>", "verbatim_source": "<exact quote>" }\n` +
  `  ],\n` +
  `  "process_steps": [\n` +
  `    { "step_number": <int>, "step": "<what happens>", "actor": "<who does it>", "system": "<system involved if named>", "outcome": "<result of this step>" }\n` +
  `  ],\n` +
  `  "data_requirements": [\n` +
  `    { "field": "<data element name>", "description": "<what it represents>", "format": "<format/type if specified>", "constraints": "<validation rules, mandatory/optional>" }\n` +
  `  ],\n` +
  `  "integrations": [\n` +
  `    { "system": "<system or service name>", "direction": "<Inbound | Outbound | Bidirectional>", "description": "<what data flows and why>", "technical_details": "<API type, format, auth if mentioned>" }\n` +
  `  ],\n` +
  `  "quantitative_data": [\n` +
  `    { "metric": "<what is being measured>", "value": "<verbatim value from document>", "context": "<what this number means for the project>" }\n` +
  `  ],\n` +
  `  "compliance_requirements": ["<regulatory, legal, or compliance requirement — quote verbatim>"],\n` +
  `  "stakeholders": [\n` +
  `    { "name_or_role": "<name or job title>", "involvement": "<their role in the process or project>" }\n` +
  `  ],\n` +
  `  "technical_specifications": ["<any named technology, platform, system version, or technical constraint>"],\n` +
  `  "assumptions_in_document": ["<assumptions the document makes>"],\n` +
  `  "constraints": ["<hard constraints: time, budget, technical, regulatory, resource>"],\n` +
  `  "risks_mentioned": ["<any risk, issue, or concern flagged in the document>"],\n` +
  `  "open_questions": ["<things that are unclear, incomplete, or contradictory — the BA must resolve these>"],\n` +
  `  "key_verbatim_quotes": ["<the most important verbatim quotes — chosen for BRD relevance>"]\n` +
  `}`;

// ─── Per-chunk extraction call ────────────────────────────────────────────────

async function extractChunk(chunkText, requestContext, chunkIndex, totalChunks) {
  const chunkLabel = totalChunks > 1
    ? `This is segment ${chunkIndex + 1} of ${totalChunks} from the document(s).`
    : "This is the complete document content.";

  const prompt =
    `${requestContext}\n\n` +
    `${chunkLabel} Extract ALL BRD-relevant information from the content below.\n\n` +
    `DOCUMENT CONTENT:\n${chunkText}\n\n` +
    `Return a JSON object matching this schema exactly:\n\n${EXTRACTION_SCHEMA}\n\n` +
    `IMPORTANT:\n` +
    `- key_requirements must include EVERY requirement found — aim for completeness, not brevity\n` +
    `- quantitative_data must capture ALL numbers, counts, percentages, time limits, SLAs, budgets, volumes\n` +
    `- If a field has no content in this segment, return an empty array or null — never fabricate\n` +
    `- Never invent or infer beyond what is explicitly stated in this content`;

  try {
    const res = await azureClient.chat.completions.create({
      model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:        [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user",   content: prompt },
      ],
      temperature:     0,
      response_format: { type: "json_object" },
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (err) {
    console.error(`[DocumentAgent] Chunk ${chunkIndex + 1} extraction failed:`, err.message);
    return null;
  }
}

// ─── Consolidation pass ───────────────────────────────────────────────────────

async function consolidateChunks(extractions, requestContext) {
  const valid = extractions.filter(Boolean);
  if (!valid.length) return null;
  if (valid.length === 1) return valid[0];

  const extractionsJson = JSON.stringify(
    valid.map((e, i) => ({ segment: i + 1, extraction: e })),
    null,
    2
  );

  const prompt =
    `${requestContext}\n\n` +
    `The document was analysed in ${valid.length} segments. Merge the extractions below into a single ` +
    `comprehensive, deduplicated result using the same schema.\n\n` +
    `SEGMENT EXTRACTIONS:\n${extractionsJson}\n\n` +
    `Return a single merged JSON object matching this schema:\n\n${EXTRACTION_SCHEMA}\n\n` +
    `Merge rules:\n` +
    `- Combine ALL items from all segments — never drop a requirement, risk, or stakeholder\n` +
    `- Deduplicate items that express the same thing (keep the most specific version)\n` +
    `- For string fields (problem_statement_in_doc, current_state, desired_state, document_summary), merge into one coherent paragraph\n` +
    `- For relevance_score, take the maximum across segments\n` +
    `- For document_types, deduplicate and merge into one list\n` +
    `- Re-number process_steps sequentially after merging\n` +
    `- key_verbatim_quotes: keep the 15 most BRD-relevant quotes from all segments`;

  try {
    const res = await azureClient.chat.completions.create({
      model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:        [
        { role: "system", content: CONSOLIDATION_SYSTEM },
        { role: "user",   content: prompt },
      ],
      temperature:     0,
      response_format: { type: "json_object" },
    });
    return JSON.parse(res.choices[0].message.content || "{}");
  } catch (err) {
    console.error("[DocumentAgent] Consolidation failed:", err.message);
    // Fall back to the richest single chunk
    return valid.reduce((best, cur) =>
      (cur.key_requirements?.length || 0) > (best.key_requirements?.length || 0) ? cur : best
    , valid[0]);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full document intelligence pipeline on the request's attachments.
 *
 * @param {Array} docs - Output of getRequestDocumentContext: [{name, mime, sizeKb, pagesEstimated, text}]
 * @param {Object} requestInfo - {title, description, category, priority}
 * @returns {Object|null} Structured analysis or null if no extractable text
 */
export async function analyzeDocumentsForBRD(docs, requestInfo) {
  if (!docs || docs.length === 0) return null;

  const usableDocs = docs.filter(
    (d) => d.text && d.text.length > 80 && !d.text.startsWith("[")
  );
  if (!usableDocs.length) return null;

  const combinedText = usableDocs
    .map((d, i) =>
      `${"=".repeat(60)}\nDOCUMENT ${i + 1}: "${d.name}" (${d.sizeKb}KB${d.pagesEstimated ? `, ~${d.pagesEstimated} pages` : ""}, ${d.mime || "unknown type"})\n${"=".repeat(60)}\n\n${d.text}`
    )
    .join("\n\n");

  const requestContext =
    `REQUEST TITLE: ${requestInfo.title || "Not specified"}\n` +
    `CATEGORY: ${requestInfo.category || "Not specified"}\n` +
    `PRIORITY: ${requestInfo.priority || "Not specified"}\n` +
    `PROBLEM STATEMENT: ${requestInfo.description || "Not specified"}`;

  const chunks = chunkDocumentText(combinedText);

  console.log(
    `[DocumentAgent] Analyzing ${usableDocs.length} doc(s) — ` +
    `${combinedText.length} chars → ${chunks.length} chunk(s) for "${requestInfo.title}"`
  );

  // Stage 2: Parallel chunk extraction
  const extractions = await Promise.all(
    chunks.map((chunk, i) => extractChunk(chunk, requestContext, i, chunks.length))
  );

  const succeeded = extractions.filter(Boolean).length;
  console.log(`[DocumentAgent] ${succeeded}/${chunks.length} chunks extracted successfully`);

  // Stage 3: Consolidate into one result
  const merged = await consolidateChunks(extractions, requestContext);
  if (!merged) return null;

  const result = {
    ...merged,
    documents_analyzed: usableDocs.map((d) => ({
      name: d.name,
      sizeKb: d.sizeKb,
      mime: d.mime,
      pagesEstimated: d.pagesEstimated || null,
      extractedChars: d.text?.length || 0,
    })),
    analyzed_at:  new Date().toISOString(),
    chunks_used:  chunks.length,
    total_chars:  combinedText.length,
  };

  console.log(
    `[DocumentAgent] Done — ` +
    `${result.key_requirements?.length || 0} requirements, ` +
    `${result.stakeholders?.length || 0} stakeholders, ` +
    `${result.risks_mentioned?.length || 0} risks`
  );

  return result;
}

/**
 * Formats the structured document analysis into a dense context block
 * that can be injected directly into AI prompts alongside raw discussion messages.
 *
 * This replaces (or supplements) passing raw document text — the structured format
 * ensures the AI sees organised, labelled information rather than raw wall-of-text.
 */
export function formatDocumentAnalysisForContext(analysis) {
  if (!analysis) return "";

  const docSummary = (analysis.documents_analyzed || [])
    .map((d) => `"${d.name}" (${d.sizeKb}KB${d.pagesEstimated ? `, ~${d.pagesEstimated}pp` : ""})`)
    .join(", ");

  const lines = [
    "=== DOCUMENT INTELLIGENCE (AI-extracted from attached documents) ===",
    `Documents: ${docSummary || "unknown"}`,
    `Document Types: ${(analysis.document_types || []).join(", ") || "Not classified"}`,
    `Relevance to Request: ${analysis.relevance_score ?? "??"}/100`,
    analysis.chunks_used > 1 ? `Extraction: ${analysis.chunks_used} segments analysed and consolidated` : "",
    analysis.document_summary ? `Summary: ${analysis.document_summary}` : "",
    "",
    `PROBLEM STATEMENT IN DOCUMENT: ${analysis.problem_statement_in_doc || "Not found"}`,
    `CURRENT STATE (as-is): ${analysis.current_state || "Not specified"}`,
    `DESIRED STATE (to-be): ${analysis.desired_state || "Not specified"}`,
  ].filter(Boolean);

  if ((analysis.key_requirements || []).length > 0) {
    lines.push("", "REQUIREMENTS EXTRACTED FROM DOCUMENTS:");
    (analysis.key_requirements || []).forEach((r, i) => {
      lines.push(
        `  ${i + 1}. [${r.type || "Functional"} / ${r.priority_hint || "Must Have"}] ${r.requirement}` +
        (r.verbatim_source ? `\n     Source: "${r.verbatim_source}"` : "")
      );
    });
  }

  if ((analysis.business_rules || []).length > 0) {
    lines.push("", "BUSINESS RULES FROM DOCUMENTS:");
    (analysis.business_rules || []).forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.rule}` + (r.verbatim_source ? ` — "${r.verbatim_source}"` : ""));
    });
  }

  if ((analysis.process_steps || []).length > 0) {
    lines.push("", "PROCESS STEPS FROM DOCUMENTS:");
    (analysis.process_steps || []).forEach((s) => {
      lines.push(`  Step ${s.step_number}: [${s.actor || "?"}] ${s.step}` +
        (s.system ? ` (System: ${s.system})` : "") +
        (s.outcome ? ` → ${s.outcome}` : ""));
    });
  }

  if ((analysis.data_requirements || []).length > 0) {
    lines.push("", "DATA REQUIREMENTS FROM DOCUMENTS:");
    (analysis.data_requirements || []).forEach((d, i) => {
      lines.push(`  ${i + 1}. ${d.field}: ${d.description}` +
        (d.format ? ` [Format: ${d.format}]` : "") +
        (d.constraints ? ` [Constraints: ${d.constraints}]` : ""));
    });
  }

  if ((analysis.integrations || []).length > 0) {
    lines.push("", "INTEGRATIONS MENTIONED IN DOCUMENTS:");
    (analysis.integrations || []).forEach((int, i) => {
      lines.push(`  ${i + 1}. ${int.system} (${int.direction}): ${int.description}` +
        (int.technical_details ? ` [${int.technical_details}]` : ""));
    });
  }

  if ((analysis.quantitative_data || []).length > 0) {
    lines.push("", "QUANTITATIVE DATA (numbers, SLAs, volumes):");
    (analysis.quantitative_data || []).forEach((q) => {
      lines.push(`  ${q.metric}: ${q.value} — ${q.context}`);
    });
  }

  if ((analysis.compliance_requirements || []).length > 0) {
    lines.push("", "COMPLIANCE / REGULATORY REQUIREMENTS:");
    (analysis.compliance_requirements || []).forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
  }

  if ((analysis.stakeholders || []).length > 0) {
    lines.push("", "STAKEHOLDERS MENTIONED IN DOCUMENTS:");
    (analysis.stakeholders || []).forEach((s) => lines.push(`  ${s.name_or_role}: ${s.involvement}`));
  }

  if ((analysis.technical_specifications || []).length > 0) {
    lines.push("", "TECHNICAL SPECIFICATIONS FROM DOCUMENTS:");
    (analysis.technical_specifications || []).forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
  }

  if ((analysis.constraints || []).length > 0) {
    lines.push("", "CONSTRAINTS FROM DOCUMENTS:");
    (analysis.constraints || []).forEach((c, i) => lines.push(`  ${i + 1}. ${c}`));
  }

  if ((analysis.risks_mentioned || []).length > 0) {
    lines.push("", "RISKS / ISSUES MENTIONED IN DOCUMENTS:");
    (analysis.risks_mentioned || []).forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }

  if ((analysis.open_questions || []).length > 0) {
    lines.push("", "OPEN QUESTIONS / AMBIGUITIES IN DOCUMENTS (BA must resolve):");
    (analysis.open_questions || []).forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
  }

  if ((analysis.key_verbatim_quotes || []).length > 0) {
    lines.push("", "KEY VERBATIM QUOTES FROM DOCUMENTS:");
    (analysis.key_verbatim_quotes || []).forEach((q, i) => lines.push(`  ${i + 1}. "${q}"`));
  }

  return lines.join("\n");
}
