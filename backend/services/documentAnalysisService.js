/**
 * documentAnalysisService.js — World-class AI document intelligence extraction.
 *
 * Takes attached document content and performs a comprehensive, structured
 * extraction of ALL information relevant to building a BRD.
 *
 * Unlike passing raw document text to the BRD generator, this service:
 *  - Runs a DEDICATED extraction pass focused entirely on the document
 *  - Returns structured JSON that maps directly to BRD sections
 *  - Makes document-derived content explicit and traceable
 *  - Stores results in DB so every downstream stage can use them
 */

import OpenAI from "openai";

const azureClient = new OpenAI({
  apiKey:         process.env.AZURE_OPENAI_API_KEY,
  baseURL:        `${(process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

const EXTRACTION_SYSTEM = `You are an expert Business Analyst performing comprehensive document intelligence extraction for enterprise requirements projects.

Your task is to extract EVERY piece of information from the provided documents that could inform a Business Requirements Document.

CRITICAL RULES:
1. Extract VERBATIM where precision matters — numbers, SLAs, dates, names, thresholds must be quoted exactly as they appear.
2. Be EXHAUSTIVE — a missing item here becomes a missing requirement in the BRD.
3. Err on the side of inclusion, not brevity.
4. Only extract what is ACTUALLY IN the document — never add your own knowledge.
5. Flag anything unclear or contradictory as an open question.
6. Distinguish between what the document STATES vs what it merely IMPLIES.`;

/**
 * Run a comprehensive AI extraction on all attached documents.
 * Returns structured JSON with all BRD-relevant intelligence extracted.
 */
export async function analyzeDocumentsForBRD(docs, requestInfo) {
  if (!docs || docs.length === 0) return null;

  const docText = docs
    .map((d, i) =>
      `=== DOCUMENT ${i + 1}: "${d.name}" (${d.sizeKb}KB, ${d.mime || "unknown type"}) ===\n${d.text}`
    )
    .join("\n\n");

  const requestContext =
    `REQUEST TITLE: ${requestInfo.title || "Not specified"}\n` +
    `CATEGORY: ${requestInfo.category || "Not specified"}\n` +
    `PRIORITY: ${requestInfo.priority || "Not specified"}\n` +
    `PROBLEM STATEMENT: ${requestInfo.description || "Not specified"}`;

  const prompt =
    `${requestContext}\n\n` +
    `The following documents have been attached to this request. ` +
    `Perform a COMPREHENSIVE extraction of ALL information relevant to understanding the business requirements.\n\n` +
    `${docText}\n\n` +
    `Return a JSON object with ALL of the following fields. Be EXHAUSTIVE:\n\n` +
    `{\n` +
    `  "document_types": ["<classify each doc: Requirements Spec | Process Document | Policy Document | Data Specification | Technical Spec | User Manual | Report | Meeting Notes | Other>"],\n` +
    `  "document_summary": "<2-3 sentence plain-English summary of what these documents collectively describe — written for a BA who has not read them>",\n` +
    `  "relevance_score": <integer 0-100 — how relevant these documents are to the stated request/problem>,\n` +
    `  "problem_statement_in_doc": "<the core business problem or opportunity as described in the documents — quote directly where possible>",\n` +
    `  "current_state": "<description of the as-is situation described in the documents — what exists today>",\n` +
    `  "desired_state": "<description of the to-be state or expected outcomes as described in the documents>",\n` +
    `  "key_requirements": [\n` +
    `    {\n` +
    `      "requirement": "<requirement text — be specific, not vague>",\n` +
    `      "type": "<Functional | Non-Functional | Business Rule | Data | Integration | Compliance | Constraint>",\n` +
    `      "priority_hint": "<Must Have | Should Have | Could Have | Won't Have — only if mentioned in doc>",\n` +
    `      "verbatim_source": "<exact quote or close paraphrase from the document that justifies this requirement>"\n` +
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
    `  "open_questions": ["<things in the document that are unclear, incomplete, or contradictory — the BA must resolve these>"],\n` +
    `  "key_verbatim_quotes": ["<the most important verbatim quotes from the document — max 10, chosen for BRD relevance>"]\n` +
    `}\n\n` +
    `IMPORTANT:\n` +
    `- key_requirements should include EVERY requirement found — aim for completeness, not brevity\n` +
    `- quantitative_data must capture ALL numbers, counts, percentages, time limits, SLAs, budgets, volumes\n` +
    `- If a field has no content in the documents, return an empty array or "Not specified in documents"\n` +
    `- Never invent or infer beyond what the document explicitly states`;

  try {
    const res = await azureClient.chat.completions.create({
      model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:        [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user",   content: prompt },
      ],
      temperature:     0,
      max_tokens:      4000,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(res.choices[0].message.content || "{}");
    return {
      ...parsed,
      documents_analyzed: docs.map((d) => ({ name: d.name, sizeKb: d.sizeKb, mime: d.mime })),
      analyzed_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[DocumentAnalysis] AI extraction failed:", err.message);
    return null;
  }
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

  const lines = [
    "=== DOCUMENT INTELLIGENCE (AI-extracted from attached documents) ===",
    `Documents: ${(analysis.documents_analyzed || []).map((d) => `"${d.name}" (${d.sizeKb}KB)`).join(", ")}`,
    `Document Types: ${(analysis.document_types || []).join(", ")}`,
    `Relevance to Request: ${analysis.relevance_score ?? "??"}/100`,
    "",
    `PROBLEM STATEMENT IN DOCUMENT: ${analysis.problem_statement_in_doc || "Not found"}`,
    `CURRENT STATE (as-is): ${analysis.current_state || "Not specified"}`,
    `DESIRED STATE (to-be): ${analysis.desired_state || "Not specified"}`,
  ];

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
