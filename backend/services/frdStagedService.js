/**
 * frdStagedService.js — Staged IT Manager pre-checks before FRD generation.
 *
 * Stage 1: BRD Readiness Check  — is the BRD detailed enough to write an FRD?
 * Stage 2: Technical Scope      — what will the FRD cover technically?
 * Stage 3: System Architecture  — high-level modules, APIs, data flow.
 *
 * All AI calls use temperature 0 and json_object response format.
 * Content is derived ONLY from the BRD provided — no hallucination.
 */

import OpenAI from "openai";

const azureClient = new OpenAI({
  apiKey:         process.env.AZURE_OPENAI_API_KEY,
  baseURL:        `${(process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

const GROUNDING_SYSTEM = `You are a senior IT Systems Architect reviewing a Business Requirements Document (BRD) before producing a Functional Requirements Document (FRD).

CRITICAL RULES — violating any of these is a failure:
1. Use ONLY information explicitly stated in the BRD provided.
2. Do NOT infer, assume, extrapolate, or add ANY information not present in the BRD.
3. Do NOT use dates, vendor names, SLA numbers, or technical details unless they appear verbatim in the BRD.
4. If required information is genuinely missing, state "Not specified in the BRD" — never fill in a plausible value.
5. Never reference your training data about similar systems. Only this BRD matters.`;

function buildBrdContext(brdContent) {
  const s = brdContent?.sections || {};
  const meta = brdContent?.meta || {};

  const lines = [
    `=== BRD DOCUMENT ===`,
    `Title: ${meta.title || "Not specified"}`,
    `Category: ${meta.category || "Not specified"}`,
    `Priority: ${meta.priority || "Not specified"}`,
    `Version: ${meta.version || "Not specified"}`,
    ``,
  ];

  if (s.executive_summary?.text)
    lines.push(`--- Executive Summary ---\n${s.executive_summary.text}\n`);

  if (s.objective?.text)
    lines.push(`--- Business Objective ---\n${s.objective.text}\n`);

  if (s.scope) {
    lines.push(`--- Scope ---`);
    if (s.scope.in_scope?.length)
      lines.push(`In Scope:\n${s.scope.in_scope.map(i => `  - ${i}`).join("\n")}`);
    if (s.scope.out_of_scope?.length)
      lines.push(`Out of Scope:\n${s.scope.out_of_scope.map(i => `  - ${i}`).join("\n")}`);
    lines.push("");
  }

  if (s.functional_requirements?.items?.length) {
    lines.push(`--- Functional Requirements ---`);
    s.functional_requirements.items.forEach(fr => {
      lines.push(`  ${fr.id}: [${fr.priority}] ${fr.description}`);
    });
    lines.push("");
  }

  if (s.non_functional_requirements?.items?.length) {
    lines.push(`--- Non-Functional Requirements ---`);
    s.non_functional_requirements.items.forEach(nfr => {
      lines.push(`  ${nfr.id} (${nfr.category}): ${nfr.requirement}`);
    });
    lines.push("");
  }

  if (s.process_flow?.steps?.length) {
    lines.push(`--- Process Flow ---`);
    s.process_flow.steps.forEach(step => {
      lines.push(`  ${step.step_number}. [${step.actor}] ${step.action} → ${step.outcome}`);
    });
    lines.push("");
  }

  if (s.risk_register?.items?.length) {
    lines.push(`--- Risks ---`);
    s.risk_register.items.forEach(r => {
      lines.push(`  ${r.id}: ${r.description} (Impact: ${r.impact})`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

// ── Stage 1: BRD Readiness Check ─────────────────────────────────────────────
export async function checkFrdReadiness(brdContent) {
  const brdContext = buildBrdContext(brdContent);

  const prompt = `${brdContext}

Review the BRD above and assess whether it contains enough detail to produce a high-quality Functional Requirements Document (FRD).

A BRD is ready for FRD generation when it has:
- Clear, specific functional requirements with priorities
- Defined scope boundaries (in-scope and out-of-scope)
- Non-functional requirements (performance, security, scalability, etc.)
- A process or workflow description
- Identifiable actors/users and system interactions
- Enough business context to understand HOW the system should behave

Respond with a JSON object:
{
  "score": <number 0-100, readiness score>,
  "readiness_level": "<Not Ready | Partially Ready | Ready | Highly Ready>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<what is well-documented in the BRD>", ...],
  "gaps": ["<specific gaps that may affect FRD quality>", ...],
  "technical_questions": ["<specific questions the IT Manager should consider before generating the FRD>", ...],
  "recommendation": "<Proceed | Proceed with caution | Address gaps first>"
}`;

  const response = await azureClient.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GROUNDING_SYSTEM },
      { role: "user",   content: prompt },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

// ── Stage 2: Technical Scope ──────────────────────────────────────────────────
export async function defineTechnicalScope(brdContent) {
  const brdContext = buildBrdContext(brdContent);

  const prompt = `${brdContext}

Based ONLY on the BRD above, define the technical scope for the Functional Requirements Document (FRD).

Respond with a JSON object:
{
  "summary": "<1-2 sentence description of what the FRD will cover technically>",
  "in_scope_components": [
    { "component": "<system component name>", "rationale": "<why it is in scope based on the BRD>" }
  ],
  "out_of_scope_components": [
    { "component": "<component/concern>", "rationale": "<why it is out of scope>" }
  ],
  "integration_points": [
    { "system": "<external system or service>", "type": "<API | Database | File | Event | Other>", "description": "<what integration is needed>" }
  ],
  "data_domains": ["<key data entities or domains the FRD will define>"],
  "ambiguities": ["<technical areas that are unclear in the BRD and may need assumption flags in the FRD>"]
}`;

  const response = await azureClient.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GROUNDING_SYSTEM },
      { role: "user",   content: prompt },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}

// ── Stage 3: System Architecture Overview ────────────────────────────────────
export async function defineSystemArchitecture(brdContent, approvedScope) {
  const brdContext = buildBrdContext(brdContent);

  const scopeBlock = approvedScope
    ? `\n=== APPROVED TECHNICAL SCOPE ===\n` +
      `In Scope: ${(approvedScope.in_scope_components || []).map(c => c.component).join(", ")}\n` +
      `Out of Scope: ${(approvedScope.out_of_scope_components || []).map(c => c.component).join(", ")}\n` +
      `Integration Points: ${(approvedScope.integration_points || []).map(i => i.system).join(", ")}\n` +
      `Data Domains: ${(approvedScope.data_domains || []).join(", ")}\n`
    : "";

  const prompt = `${brdContext}${scopeBlock}

Based ONLY on the BRD and approved technical scope above, propose a high-level system architecture for the FRD.

Respond with a JSON object:
{
  "summary": "<2-3 sentence architecture overview>",
  "system_modules": [
    {
      "name": "<module name>",
      "responsibility": "<what this module does>",
      "brd_refs": ["<FR-001>", "<FR-002>"]
    }
  ],
  "data_flow": [
    { "step": <number>, "from": "<actor or module>", "to": "<module or system>", "description": "<what data or action flows>" }
  ],
  "api_contracts": [
    { "endpoint": "<e.g. POST /loans/apply>", "purpose": "<what it does>", "consumed_by": "<actor or module>" }
  ],
  "technology_constraints": ["<constraints implied by the BRD, e.g. must support PDF upload>"],
  "open_decisions": ["<architectural decisions not determinable from the BRD alone>"]
}`;

  const response = await azureClient.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: GROUNDING_SYSTEM },
      { role: "user",   content: prompt },
    ],
  });

  return JSON.parse(response.choices[0].message.content);
}
