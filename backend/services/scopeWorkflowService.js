/**
 * scopeWorkflowService.js — Grounded scope definition and workflow generation.
 *
 * Every AI call uses a strict grounding system prompt that forbids hallucination.
 * All content is derived ONLY from the actual discussion and attached documents.
 *
 * Staged flow:
 *  1. checkCompleteness() — AI assesses whether the discussion has enough to write a BRD
 *  2. generateScope()     — AI extracts in-scope / out-of-scope / gaps from discussion
 *  3. generateWorkflow()  — AI builds process steps from the BA-approved scope
 */

import OpenAI from "openai";
import { formatDocumentAnalysisForContext } from "./documentAnalysisService.js";

const azureClient = new OpenAI({
  apiKey:         process.env.AZURE_OPENAI_API_KEY,
  baseURL:        `${(process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

// ─── Strict grounding system prompt ──────────────────────────────────────────
const GROUNDING_SYSTEM = `You are a senior Business Analyst writing formal requirements documentation.

CRITICAL RULES — violating any of these is a failure:
1. Use ONLY information explicitly stated in the discussion and attached documents provided.
2. Do NOT infer, assume, extrapolate, or add ANY information not present in the source material.
3. Do NOT use dates, vendor names, SLA numbers, or technical details unless they appear verbatim in the source.
4. If required information is genuinely missing, state "Not specified in the discussion" — never fill in a plausible value.
5. Never reference content from your training data about similar projects. Only this project's discussion matters.`;

// ─── Shared context builder ───────────────────────────────────────────────────
function buildSourceContext(messages, requestInfo, documentText, documentAnalysis = null) {
  const submittedDate = requestInfo.created_at
    ? new Date(requestInfo.created_at).toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "Not provided";

  const msgBlock = messages
    .map((m, i) => `[${i + 1}] ${m.sender_name || "Unknown"}: ${m.message_text}`)
    .join("\n");

  // Use structured document intelligence if available — more signal-dense than raw text
  const docBlock = documentAnalysis
    ? `\n\n${formatDocumentAnalysisForContext(documentAnalysis)}`
    : (documentText ? `\n\n=== ATTACHED DOCUMENTS ===\n${documentText}` : "");

  return (
    `=== PROJECT CONTEXT ===\n` +
    `Request Title: ${requestInfo.title || "Not specified"}\n` +
    `Category: ${requestInfo.category || "Not specified"}\n` +
    `Priority: ${requestInfo.priority || "Not specified"}\n` +
    `Submitted: ${submittedDate}\n` +
    (requestInfo.description ? `Problem Statement: ${requestInfo.description}\n` : "") +
    `\n=== DISCUSSION (marked key messages) ===\n${msgBlock || "(No messages marked — derive from documents and request context)"}` +
    docBlock
  );
}

// ─── Completeness check ───────────────────────────────────────────────────────
/**
 * Analyses the discussion and returns what is present, what is missing,
 * and specific questions the BA should resolve before drafting the BRD.
 */
export async function checkCompleteness(messages, requestInfo, documentText = "", documentAnalysis = null) {
  const source = buildSourceContext(messages, requestInfo, documentText, documentAnalysis);

  const prompt =
    `${source}\n\n` +
    `Analyse the discussion above and assess whether there is enough information to write a complete, high-quality BRD.\n\n` +
    `A complete BRD discussion should cover:\n` +
    `- The specific business problem or opportunity being addressed\n` +
    `- Who the users or stakeholders are and what they need\n` +
    `- The key functional capabilities the system must provide\n` +
    `- Any non-functional requirements (performance, security, compliance, etc.)\n` +
    `- The scope boundaries — what is and is not included\n` +
    `- Success criteria or acceptance conditions\n` +
    `- Any key constraints, dependencies, or risks identified\n` +
    `- Integration or data requirements if applicable\n\n` +
    `Return a JSON object:\n` +
    `{\n` +
    `  "completeness_score": <integer 0-100>,\n` +
    `  "readiness": "<Ready to draft | Needs clarification | Insufficient — more discussion required>",\n` +
    `  "present": ["list of topics clearly covered in the discussion"],\n` +
    `  "missing": ["list of critical gaps — things a BRD must have but the discussion has not addressed"],\n` +
    `  "clarification_questions": ["specific, targeted questions the BA should ask the stakeholder before proceeding — be direct and actionable"],\n` +
    `  "documents_referenced": <true|false>\n` +
    `}\n\n` +
    `Scoring guide:\n` +
    `- 0–39: Critical gaps — major requirements areas not discussed at all\n` +
    `- 40–64: Needs clarification — core problem understood but important details missing\n` +
    `- 65–84: Nearly ready — most areas covered, some specifics to confirm\n` +
    `- 85–100: Ready to draft — sufficient detail to produce a high-quality BRD\n\n` +
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
export async function generateScope(messages, requestInfo, documentText = "", documentAnalysis = null) {
  const source = buildSourceContext(messages, requestInfo, documentText, documentAnalysis);

  const prompt =
    `${source}\n\n` +
    `Based ONLY on the discussion and documents above, define the project scope.\n\n` +
    `Return a JSON object:\n` +
    `{\n` +
    `  "scope_title": "<short descriptive title for this project scope>",\n` +
    `  "in_scope": ["each capability, feature, or deliverable that the discussion EXPLICITLY includes in this project"],\n` +
    `  "out_of_scope": ["each capability explicitly excluded, deferred, or described as out-of-scope or 'future phase'"],\n` +
    `  "ambiguities": ["items mentioned but not clearly inside or outside scope — must be resolved by BA/stakeholder"],\n` +
    `  "critical_gaps": ["information the BA MUST obtain before writing the BRD — be specific about what is missing"],\n` +
    `  "source_references": ["verbatim quote from the discussion that justifies each in-scope item (one quote per item)"]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Only list in_scope items backed by explicit statements in the discussion.\n` +
    `- Write each in_scope item as a clear, specific deliverable (not vague categories).\n` +
    `- Do not add features, integrations, or flows not mentioned by the stakeholders.\n` +
    `- If something is implied but not stated, put it in ambiguities — not in_scope.\n` +
    `- out_of_scope items should be specific, not generic placeholders.\n` +
    `- critical_gaps should name exactly what information is needed and why.`;

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
export async function generateWorkflow(approvedScope, messages, requestInfo, documentText = "", documentAnalysis = null) {
  const source     = buildSourceContext(messages, requestInfo, documentText, documentAnalysis);
  const scopeItems = (approvedScope.in_scope || []).map((s, i) => `${i + 1}. ${s}`).join("\n");

  const prompt =
    `${source}\n\n` +
    `The BA has approved the following in-scope items:\n${scopeItems}\n\n` +
    `Generate a step-by-step end-to-end business process workflow for this project.\n\n` +
    `Return a JSON object:\n` +
    `{\n` +
    `  "workflow_title": "<descriptive end-to-end process name derived from the discussion>",\n` +
    `  "steps": [\n` +
    `    {\n` +
    `      "step": <number>,\n` +
    `      "name": "<concise step name>",\n` +
    `      "actor": "<who performs this — use roles or names from the discussion>",\n` +
    `      "action": "<what they do — specific and grounded in the discussion>",\n` +
    `      "outcome": "<what results from this step — the deliverable or state change>",\n` +
    `      "systems_involved": ["<only systems explicitly mentioned in discussion>"],\n` +
    `      "decision_point": "<if this step has a decision or branch, describe it; else null>"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Only include steps directly supported by the discussion and approved scope.\n` +
    `- Cover the complete end-to-end flow from initiation to completion.\n` +
    `- Do not add generic technical steps (logging, audit, notifications) unless mentioned in discussion.\n` +
    `- Actors must come from the discussion — do not invent roles not mentioned.\n` +
    `- Systems must be explicitly named in the discussion — do not assume.\n` +
    `- Each step's outcome must be a concrete deliverable or verifiable state change.\n` +
    `- If the discussion mentions decision points or conditional flows, capture them in decision_point.`;

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
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((s, i) => ({ ...s, step: i + 1, decision_point: s.decision_point || null }))
        : [],
    };
  } catch {
    return { workflow_title: requestInfo.title, steps: [] };
  }
}
