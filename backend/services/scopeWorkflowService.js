/**
 * scopeWorkflowService.js — Grounded scope definition and workflow generation.
 *
 * Every AI call uses a strict grounding system prompt that forbids hallucination.
 * All content is derived ONLY from the actual discussion and attached documents.
 *
 * Staged flow:
 *  1. generateScope()    — AI extracts in-scope / out-of-scope / gaps from discussion
 *  2. generateWorkflow() — AI builds process steps from the BA-approved scope
 */

import OpenAI from "openai";

const azureClient = new OpenAI({
  apiKey:         process.env.AZURE_OPENAI_API_KEY,
  baseURL:        `${(process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

// ─── Strict grounding system prompt ──────────────────────────────────────────
const GROUNDING_SYSTEM = `You are a precise Business Analyst writing formal requirements documentation.

CRITICAL RULES — violating any of these is a failure:
1. Use ONLY information explicitly stated in the discussion and attached documents provided to you.
2. Do NOT infer, assume, extrapolate, or add ANY information not present in the source material.
3. Do NOT use dates, vendor names, SLA numbers, or technical details unless they appear verbatim in the source.
4. If required information is genuinely missing, state exactly "Not specified in the discussion" — never fill in a plausible value.
5. Never reference content from your training data about similar projects. Only this project's discussion matters.`;

// ─── Shared context builder ───────────────────────────────────────────────────
function buildSourceContext(messages, requestInfo, documentText) {
  const submittedDate = requestInfo.created_at
    ? new Date(requestInfo.created_at).toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "Not provided";

  const msgBlock = messages
    .map((m, i) => `[${i + 1}] ${m.sender_name || "Unknown"}: ${m.message_text}`)
    .join("\n");

  const docBlock = documentText
    ? `\n\n=== ATTACHED DOCUMENTS ===\n${documentText}`
    : "";

  return (
    `=== PROJECT CONTEXT ===\n` +
    `Request Title: ${requestInfo.title || "Not specified"}\n` +
    `Category: ${requestInfo.category || "Not specified"}\n` +
    `Priority: ${requestInfo.priority || "Not specified"}\n` +
    `Submitted: ${submittedDate}\n` +
    (requestInfo.description ? `Problem Statement: ${requestInfo.description}\n` : "") +
    `\n=== DISCUSSION (marked key messages) ===\n${msgBlock}` +
    docBlock
  );
}

// ─── Completeness check ───────────────────────────────────────────────────────
/**
 * Analyses the discussion and returns what is present, what is missing,
 * and specific questions the BA should resolve before drafting the BRD.
 */
export async function checkCompleteness(messages, requestInfo, documentText = "") {
  const source = buildSourceContext(messages, requestInfo, documentText);

  const prompt =
    `${source}\n\n` +
    `Analyse the discussion above and assess whether there is enough information to write a complete BRD.\n\n` +
    `Return a JSON object with:\n` +
    `{\n` +
    `  "completeness_score": <integer 0-100>,\n` +
    `  "readiness": "<Ready to draft | Needs clarification | Insufficient — more discussion required>",\n` +
    `  "present": ["list of topics clearly covered in the discussion"],\n` +
    `  "missing": ["list of critical gaps — things a BRD must have but the discussion has not addressed"],\n` +
    `  "clarification_questions": ["specific questions the BA should ask the stakeholder before proceeding"],\n` +
    `  "documents_referenced": <true|false>\n` +
    `}\n\n` +
    `Base your assessment ONLY on what is in the discussion above. Do not add assumptions.`;

  const res = await azureClient.chat.completions.create({
    model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages:        [
      { role: "system", content: GROUNDING_SYSTEM },
      { role: "user",   content: prompt },
    ],
    temperature:     0,
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return {
      completeness_score: 0,
      readiness: "Needs clarification",
      present: [],
      missing: ["Unable to parse completeness check result"],
      clarification_questions: [],
      documents_referenced: false,
    };
  }
}

// ─── Scope definition ─────────────────────────────────────────────────────────
/**
 * Extracts a structured scope definition from the discussion.
 * Returns in-scope items, out-of-scope items, ambiguities, and critical gaps.
 */
export async function generateScope(messages, requestInfo, documentText = "") {
  const source = buildSourceContext(messages, requestInfo, documentText);

  const prompt =
    `${source}\n\n` +
    `Based ONLY on the discussion and documents above, define the project scope.\n\n` +
    `Return a JSON object:\n` +
    `{\n` +
    `  "scope_title": "<short descriptive title for this project scope>",\n` +
    `  "in_scope": ["each item that the discussion explicitly says is part of this project"],\n` +
    `  "out_of_scope": ["each item explicitly excluded, deferred, or described as 'future phase'"],\n` +
    `  "ambiguities": ["items mentioned but not clearly inside or outside scope — needs BA/stakeholder decision"],\n` +
    `  "critical_gaps": ["information the BA MUST obtain before writing the BRD"],\n` +
    `  "source_references": ["quote the exact message text that justifies each in-scope item (one quote per item)"]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Only list in_scope items that are backed by explicit statements in the discussion.\n` +
    `- Do not add features, integrations, or flows not mentioned by the stakeholders.\n` +
    `- If something is implied but not stated, put it in ambiguities, not in_scope.`;

  const res = await azureClient.chat.completions.create({
    model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages:        [
      { role: "system", content: GROUNDING_SYSTEM },
      { role: "user",   content: prompt },
    ],
    temperature:     0,
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return {
      scope_title: requestInfo.title,
      in_scope: [],
      out_of_scope: [],
      ambiguities: [],
      critical_gaps: ["Scope could not be parsed — please try again"],
      source_references: [],
    };
  }
}

// ─── Workflow generation ──────────────────────────────────────────────────────
/**
 * Generates a step-by-step business process workflow from the BA-approved scope.
 * Steps are grounded strictly in the discussion — no generic filler steps added.
 */
export async function generateWorkflow(approvedScope, messages, requestInfo, documentText = "") {
  const source = buildSourceContext(messages, requestInfo, documentText);
  const scopeItems = (approvedScope.in_scope || []).map((s, i) => `${i + 1}. ${s}`).join("\n");

  const prompt =
    `${source}\n\n` +
    `The BA has approved the following in-scope items:\n${scopeItems}\n\n` +
    `Generate a step-by-step business process workflow for this project.\n\n` +
    `Return a JSON object:\n` +
    `{\n` +
    `  "workflow_title": "<end-to-end process name derived from the discussion>",\n` +
    `  "steps": [\n` +
    `    {\n` +
    `      "step": <number>,\n` +
    `      "name": "<step name>",\n` +
    `      "actor": "<who performs this — use roles/names from the discussion>",\n` +
    `      "action": "<what they do — grounded in the discussion>",\n` +
    `      "outcome": "<what results from this step>",\n` +
    `      "systems_involved": ["<only systems explicitly mentioned in discussion>"]\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Only include steps that are supported by the discussion.\n` +
    `- Do not add generic IT steps (logging, notifications, etc.) unless the discussion mentions them.\n` +
    `- Actors must come from the discussion — do not invent roles.\n` +
    `- Systems must be explicitly named in the discussion — do not assume.`;

  const res = await azureClient.chat.completions.create({
    model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    messages:        [
      { role: "system", content: GROUNDING_SYSTEM },
      { role: "user",   content: prompt },
    ],
    temperature:     0,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(res.choices[0].message.content);
    return {
      workflow_title: parsed.workflow_title || requestInfo.title,
      steps: Array.isArray(parsed.steps) ? parsed.steps.map((s, i) => ({ ...s, step: i + 1 })) : [],
    };
  } catch {
    return { workflow_title: requestInfo.title, steps: [] };
  }
}
