/**
 * BRD Generator — Enterprise-grade AI document generation engine.
 *
 * Every section is grounded exclusively in the project's actual discussion and documents.
 * No hardcoded domain-specific boilerplate — applicable to any industry or domain.
 *
 * Pipeline:
 *  1. Source context assembly   — messages + documents + request metadata
 *  2. Parallel AI extraction    — 11 independent grounded AI calls (run concurrently)
 *  3. Scope assembly            — uses BA-approved scope + workflow from staged flow
 *  4. Full BRD JSON assembly    — 13 numbered sections, IDs, version metadata
 */

import OpenAI from "openai";
import { formatDocumentAnalysisForContext } from "./documentAnalysisService.js";

const azureClient = new OpenAI({
  apiKey:         process.env.AZURE_OPENAI_API_KEY,
  baseURL:        `${(process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

// ─── MoSCoW priority ─────────────────────────────────────────────────────────
const MUST_RE   = /\b(must|critical|mandatory|required|essential|shall|has to|need to|necessary)\b/i;
const SHOULD_RE = /\b(should|important|ideally|recommended|desired|expected)\b/i;
const COULD_RE  = /\b(could|nice to have|optional|consider|may|might|possible)\b/i;
const WONT_RE   = /\b(won't|will not|out of scope|future|later|phase 2|not in scope)\b/i;

function moscowPriority(text) {
  if (WONT_RE.test(text))   return "Won't Have";
  if (MUST_RE.test(text))   return "Must Have";
  if (SHOULD_RE.test(text)) return "Should Have";
  if (COULD_RE.test(text))  return "Could Have";
  return "Must Have";
}

// ─── Stakeholder extraction ───────────────────────────────────────────────────
function extractStakeholders(messages, requestInfo) {
  const names = new Set();
  messages.forEach((m) => { if (m.sender_name) names.add(m.sender_name); });
  const list = [...names].map((name) => ({
    name,
    role: name === requestInfo.stakeholder_name
      ? "Primary Stakeholder / Business Owner"
      : "Discussion Participant",
  }));
  if (requestInfo.stakeholder_name && !names.has(requestInfo.stakeholder_name))
    list.unshift({ name: requestInfo.stakeholder_name, role: "Primary Stakeholder / Business Owner" });
  list.push({ name: "Business Analyst",  role: "BRD Author / Requirements Owner" });
  list.push({ name: "IT Implementation", role: "Technical Feasibility & Implementation" });
  return list;
}

function cap(str = "") { return str.charAt(0).toUpperCase() + str.slice(1); }

// ─── Text cleaner ─────────────────────────────────────────────────────────────
function cleanToRequirement(raw) {
  let text = String(raw)
    .replace(/^(next step[s]?[:\s,]*|action[:\s,]*|noted[.\s,]*|understood[.\s,]*|agreed[.\s,]*|sure[,\s]+|ok[ay]*[,.\s]+|thanks?[,.\s]+|yes[,.\s]+|no[,.\s]+|right[,.\s]+)/i, "")
    .replace(/^(do we have[^?]*\??\s*|have we [^?]*\??\s*|is there [^?]*\??\s*)/i, "")
    .replace(/^(so[,\s]+|well[,\s]+|basically[,\s]+|honestly[,\s]+|actually[,\s]+)/i, "")
    .replace(/^(just to clarify[,:\s]*|to confirm[,:\s]*|to summarise[,:\s]*|just checking[,:\s]*)/i, "")
    .replace(/^(from (my|our|the) (side|end|perspective)[,:\s]*)/i, "")
    .replace(/^(as (mentioned|discussed|agreed)[,:\s]*)/i, "")
    .replace(/^(one more thing[,:\s]*|also[,:\s]+|additionally[,:\s]+|furthermore[,:\s]+)/i, "")
    .replace(/\b(I've|we've)\b/gi, "the team has")
    .replace(/\b(I'll|we'll)\b/gi, "the team will")
    .replace(/\b(I'm|we're)\b/gi, "the system is")
    .replace(/\b(I |me )\b/gi, "the organisation ")
    .replace(/\b(my |our )\b/gi, "the organisation's ")
    .replace(/\b(we need to|we should|we must|we want to)\b/gi, "the system shall")
    .replace(/\b(you need to|you should|you must)\b/gi, "the system shall")
    .replace(/\b(we are|we have)\b/gi, "the system")
    .replace(/^(also\s+)?(noticing|noticed|aware that|seeing that|there is a concern that)\s+/i, "")
    .replace(/^(there are (some\s+)?issues? with|there (is|are) a problem with)\s+/i, "There are issues with ")
    .replace(/^(so the idea is|the plan is|what (i|we) (want|need) is)[,:\s]*/i, "")
    .replace(/^(what happens when|what about|how about)[,:\s]*/i, "")
    .replace(/\?+$/, "")
    .replace(/\s*(right|correct|ok|okay|yeah)\s*\.?\s*$/i, "")
    .replace(/\s+/g, " ").trim();
  if (text.length < 10) text = raw.trim();
  return cap(text);
}

// ─── Strict grounding system prompt ──────────────────────────────────────────
const GROUNDING_SYSTEM = `You are a senior Business Analyst writing formal BRD documentation for enterprise projects.

CRITICAL RULES — violating any of these is a failure:
1. Use ONLY information explicitly stated in the source discussion and attached documents provided.
2. Do NOT infer, assume, extrapolate, or add ANY information not present in the source material.
3. Do NOT use dates, vendor names, SLA values, or technical details unless they appear verbatim in the source.
4. If required information is genuinely missing, state "Not specified in the discussion" — never fill in a plausible value.
5. Never draw on training data about similar projects or domains. Only this project's actual discussion matters.
6. Every statement you write must be traceable to at least one message or document in the source context.`;

// ─── Source context builder ───────────────────────────────────────────────────
function buildFullSourceContext(messages, requestInfo, documentText = "", documentAnalysis = null) {
  const submittedDate = requestInfo.created_at
    ? new Date(requestInfo.created_at).toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "Not provided";

  const msgBlock = messages.length
    ? messages.map((m, i) => `[${i + 1}] ${m.sender_name || "Participant"}: ${m.message_text}`).join("\n")
    : "(No messages provided)";

  // Prefer structured document analysis over raw text — it's more signal-dense and AI-friendly
  const docBlock = documentAnalysis
    ? `\n\n${formatDocumentAnalysisForContext(documentAnalysis)}`
    : (documentText ? `\n\n=== ATTACHED DOCUMENTS ===\n${documentText}` : "");

  return (
    `=== PROJECT CONTEXT ===\n` +
    `Title: ${requestInfo.title || "Not specified"}\n` +
    `Category: ${requestInfo.category || "Not specified"}\n` +
    `Priority: ${requestInfo.priority || "Not specified"}\n` +
    `Submitted: ${submittedDate}\n` +
    (requestInfo.description ? `Problem Statement: ${requestInfo.description}\n` : "") +
    `\n=== KEY DISCUSSION MESSAGES ===\n${msgBlock}` +
    docBlock
  );
}

// ─── AI generation helpers ────────────────────────────────────────────────────
async function generateGroundedText(prompt, sourceContext, maxTokens = 400) {
  try {
    const response = await azureClient.chat.completions.create({
      model:      process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:   [
        { role: "system", content: GROUNDING_SYSTEM },
        { role: "user",   content: `${sourceContext}\n\n${prompt}` },
      ],
      temperature: 0,
      max_tokens:  maxTokens,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (err) {
    console.warn("[BRD Generator] Grounded text generation failed:", err.message);
    return "";
  }
}

async function generateGroundedJSON(prompt, sourceContext, maxTokens = 2000) {
  try {
    const response = await azureClient.chat.completions.create({
      model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:        [
        { role: "system", content: GROUNDING_SYSTEM },
        { role: "user",   content: `${sourceContext}\n\n${prompt}` },
      ],
      temperature:     0,
      max_tokens:      maxTokens,
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (err) {
    console.warn("[BRD Generator] JSON generation failed:", err.message);
    return {};
  }
}

async function generateText(prompt, maxTokens = 300) {
  try {
    const response = await azureClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:    [
        { role: "system", content: "You are a professional Business Analyst writing formal requirements documents. Be concise, precise, and use professional business language." },
        { role: "user",   content: prompt },
      ],
      temperature: 0.3,
      max_tokens:  maxTokens,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (err) {
    console.warn("[BRD Generator] Text generation failed:", err.message);
    return "";
  }
}

// ─── Formal requirement rewriter ─────────────────────────────────────────────
const INFORMAL_TO_REQUIREMENT = [
  [/^(need[s]? to|need a|need an)\s+/i,                    "provide "],
  [/^(want[s]? to|would like to)\s+/i,                     "enable users to "],
  [/^(allow[s]? user[s]? to|let[s]? user[s]? )/i,         "enable authorised users to "],
  [/^(should be able to|must be able to)\b/i,              "enable authorised users to "],
  [/^(ensure[s]? that )/i,                                 "enforce that "],
  [/^(check[s]? (that|if|whether) )/i,                     "validate that "],
  [/^(track[s]?|monitor[s]?) /i,                           "record and report on "],
  [/^(send[s]?|notif(y|ies)|alert[s]?) /i,                 "dispatch automated notifications for "],
  [/^(store[s]?|sav(e|es)|persist[s]?) /i,                 "securely store and retrieve "],
  [/^(display[s]?|show[s]?|present[s]?) /i,                "display to authorised users "],
  [/^(generat(e[s]?|es?)|creat(e[s]?|es?)) /i,            "generate and make available "],
];

async function formaliseRequirement(text) {
  const cleaned = cleanToRequirement(text);
  if (/^the system shall/i.test(cleaned)) return cap(cleaned);
  const prompt = `Rewrite the following as a single concise formal business system requirement starting with exactly "The system shall". Return only the requirement sentence, nothing else.\n\nInput: ${cleaned.slice(0, 250)}`;
  const out    = await generateText(prompt, 120);
  if (out.length > 20 && /^The system shall/i.test(out) && out.length < 400 && !/undefined|null/i.test(out))
    return cap(out);
  let core = cleaned;
  for (const [re, replacement] of INFORMAL_TO_REQUIREMENT) {
    if (re.test(core)) { core = core.replace(re, replacement); break; }
  }
  core = core
    .replace(/^the system shall /i, "")
    .replace(/^the organisation\s+(needs?|must|should|wants?)\s+/i, "")
    .replace(/^(there are (some\s+)?)/i, "");
  return `The system shall ${core.charAt(0).toLowerCase() + core.slice(1)}`;
}

// ─── NFR generation (AI-grounded) ────────────────────────────────────────────
async function generateNFRsFromContext(sourceContext) {
  const prompt =
    `From the source project discussion and documents, identify Non-Functional Requirements.\n\n` +
    `Consider these categories, but ONLY include those with explicit evidence in the discussion:\n` +
    `- Performance: response times, throughput, latency, speed requirements\n` +
    `- Security: authentication, authorisation, encryption, access control, data protection\n` +
    `- Availability: uptime, reliability, redundancy, disaster recovery, fault tolerance\n` +
    `- Scalability: concurrent users, volume growth, load handling, peak traffic\n` +
    `- Usability: UI/UX standards, accessibility, device/browser support, user experience\n` +
    `- Data Privacy & Compliance: GDPR, regulatory requirements, data retention, consent\n` +
    `- Interoperability: API standards, integration protocols, data formats, compatibility\n` +
    `- Maintainability: code quality, deployment, monitoring, logging, support\n` +
    `- Reliability: data integrity, error handling, recovery, fault tolerance\n` +
    `- Auditability: audit logging, audit trails, compliance reporting, traceability\n\n` +
    `RULES:\n` +
    `- ONLY include a category if the discussion EXPLICITLY mentions or clearly requires it.\n` +
    `- Each description must be a formal "The system shall..." statement.\n` +
    `- Use ONLY values mentioned in the source (e.g., if "3 seconds" is mentioned, use it).\n` +
    `- Never invent SLAs, percentages, or technical values not in the source.\n` +
    `- Aim for 3–7 NFRs, each grounded in actual discussion content.\n\n` +
    `Return JSON: { "nfrs": [ { "category": "<NFR category>", "description": "<The system shall... statement>" } ] }`;

  const result = await generateGroundedJSON(prompt, sourceContext, 1200);
  const items  = Array.isArray(result.nfrs) ? result.nfrs : [];
  return items.map((nfr, i) => ({
    id:          `NFR-${String(i + 1).padStart(3, "0")}`,
    category:    nfr.category    || `NFR ${i + 1}`,
    description: nfr.description || "Not specified in the discussion.",
  }));
}

// ─── Business rules generation (AI-grounded) ─────────────────────────────────
async function generateBusinessRulesFromContext(sourceContext) {
  const prompt =
    `From the source project discussion and documents, extract all explicit BUSINESS RULES.\n\n` +
    `Business rules include:\n` +
    `- Calculation rules (how values are computed, formulas, algorithms, derived fields)\n` +
    `- Validation rules (what inputs are acceptable, format requirements, field constraints)\n` +
    `- Decision rules (if-then logic, eligibility criteria, routing conditions, approval gates)\n` +
    `- Process rules (mandatory steps, sequencing requirements, prerequisites, order of operations)\n` +
    `- Constraint rules (limits, thresholds, caps, minimums/maximums, time windows)\n` +
    `- Data rules (what must be captured, retained, deleted, or masked)\n` +
    `- Authorisation rules (who can do what, approval requirements, role restrictions)\n\n` +
    `RULES:\n` +
    `- ONLY extract rules EXPLICITLY stated or directly implied in the discussion.\n` +
    `- Write each as a formal, specific, unambiguous rule statement.\n` +
    `- Include specific values or thresholds if mentioned in the discussion.\n` +
    `- If no domain-specific rules are mentioned, return only the governance defaults below.\n\n` +
    `Return JSON: { "rules": ["<formal business rule statement>", ...] }`;

  const result = await generateGroundedJSON(prompt, sourceContext, 900);
  const rules  = Array.isArray(result.rules) ? result.rules : [];

  if (!rules.some((r) => /audit/i.test(r)))
    rules.push("All state-changing operations shall be recorded in an immutable audit log capturing actor identity, action performed, affected entity, and outcome timestamp.");
  if (!rules.some((r) => /validation/i.test(r)))
    rules.push("All business logic and data validation shall be enforced server-side. Client-side validation is supplementary and shall not be relied upon as the sole control.");

  return rules.map((rule, i) => ({
    id:          `BR-${String(i + 1).padStart(3, "0")}`,
    description: rule,
  }));
}

// ─── Integration requirements generation (AI-grounded) ───────────────────────
async function generateIntegrationRequirementsFromContext(sourceContext) {
  const prompt =
    `From the source project discussion and documents, identify ALL integration requirements.\n\n` +
    `Look for:\n` +
    `- External systems, platforms, or applications mentioned by name\n` +
    `- Third-party APIs, SaaS services, or data providers\n` +
    `- Data exchange with other internal or external systems\n` +
    `- Inbound data feeds or outbound data pushes\n` +
    `- Middleware, message queues, event streams, or webhooks\n` +
    `- Authentication/authorisation services (OAuth, SSO, LDAP)\n` +
    `- Reporting, analytics, or BI platforms\n` +
    `- Payment gateways, notification services, or communication platforms\n\n` +
    `RULES:\n` +
    `- ONLY include integrations explicitly mentioned in the discussion or documents.\n` +
    `- Do NOT assume standard integrations (email, auth, DB) unless specifically mentioned.\n` +
    `- Capture all available technical details from the discussion (API type, auth, formats, SLA).\n` +
    `- If nothing is mentioned, return an empty array.\n\n` +
    `Return JSON: { "integrations": [ {\n` +
    `  "type": "<REST API | SOAP | File Transfer | Database | Webhook | Messaging | OAuth | Other>",\n` +
    `  "system": "<system/vendor name from discussion>",\n` +
    `  "direction": "<Inbound | Outbound | Bidirectional>",\n` +
    `  "input": "<input data description>",\n` +
    `  "output": "<output data description>",\n` +
    `  "auth": "<authentication method if mentioned, else 'Not specified'>",\n` +
    `  "sla": "<SLA/performance requirement if mentioned, else 'Not specified'>",\n` +
    `  "description": "<what this integration does and why it is needed>"\n` +
    `} ] }`;

  const result = await generateGroundedJSON(prompt, sourceContext, 1000);
  const items  = Array.isArray(result.integrations) ? result.integrations : [];
  return items.map((int, i) => ({
    id:          `INT-${String(i + 1).padStart(3, "0")}`,
    type:        int.type        || "REST API",
    system:      int.system      || "External System",
    direction:   int.direction   || "Outbound",
    input:       int.input       || "Not specified",
    output:      int.output      || "Not specified",
    auth:        int.auth        || "Not specified",
    sla:         int.sla         || "Not specified",
    description: int.description || "Integration requirement derived from discussion.",
  }));
}

// ─── Risk register generation (AI-grounded) ──────────────────────────────────
async function generateRisksFromContext(sourceContext, concerns) {
  const concernsText = concerns.length > 0
    ? `\nAdditional stakeholder concerns to formalise as risks:\n${concerns.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
    : "";

  const prompt =
    `From the source project discussion and documents, identify ALL risks and concerns that could affect project success.${concernsText}\n\n` +
    `For each risk:\n` +
    `1. Write a formal, professional 2–3 sentence description explaining the risk clearly\n` +
    `2. Assess IMPACT (High/Medium/Low) based on what was discussed\n` +
    `3. Assess PROBABILITY (High/Medium/Low) based on context and stakeholder signals\n` +
    `4. Provide a SPECIFIC, actionable mitigation strategy relevant to THIS project\n\n` +
    `Risk sources to consider:\n` +
    `- Technical risks (integration complexity, technology choices, performance)\n` +
    `- Schedule/delivery risks (timeline, dependencies, milestones)\n` +
    `- Requirements risks (ambiguities, incomplete information, changing scope)\n` +
    `- Stakeholder risks (alignment, availability, competing priorities)\n` +
    `- Compliance/regulatory risks (data protection, approvals, legal obligations)\n` +
    `- Resource risks (team capacity, skills, third-party readiness)\n` +
    `- Data risks (data quality, migration complexity, privacy)\n\n` +
    `RULES:\n` +
    `- Ground every risk in what was actually discussed or the concerns listed above.\n` +
    `- Mitigation strategies must be specific to this project, not generic platitudes.\n` +
    `- Aim for 4–8 risks covering the key concern areas identified.\n\n` +
    `Return JSON: { "risks": [ {\n` +
    `  "description": "<professional 2–3 sentence risk description>",\n` +
    `  "impact": "High|Medium|Low",\n` +
    `  "probability": "High|Medium|Low",\n` +
    `  "mitigation": "<specific, actionable mitigation strategy for this project>"\n` +
    `} ] }`;

  const result = await generateGroundedJSON(prompt, sourceContext, 1500);
  const risks  = Array.isArray(result.risks) ? result.risks : [];
  return risks.map((r, i) => ({
    id:          `R-${String(i + 1).padStart(3, "0")}`,
    description: r.description || "Risk identified from discussion.",
    impact:      r.impact      || "Medium",
    probability: r.probability || "Medium",
    mitigation:  r.mitigation  || "Assign a named risk owner and review at each milestone gate.",
  }));
}

// ─── Action items generation (AI-grounded) ────────────────────────────────────
async function generateActionItemsFromContext(sourceContext, rawItems) {
  const rawText = rawItems.length > 0
    ? `\nAdditional action items identified from analysis:\n${rawItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "";

  const prompt =
    `From the source project discussion and documents, identify and formalise ALL action items and next steps.${rawText}\n\n` +
    `For each action item, write a formal description that:\n` +
    `1. States clearly WHAT needs to be done\n` +
    `2. States WHO should do it (if mentioned in the discussion)\n` +
    `3. States WHEN or under what condition it must be completed (if mentioned)\n` +
    `4. States the expected OUTCOME or deliverable\n\n` +
    `Sources of action items:\n` +
    `- Explicitly mentioned next steps or follow-ups from the discussion\n` +
    `- Pending decisions requiring stakeholder input before development can start\n` +
    `- Clarifications or requirement workshops needed\n` +
    `- Technical validations, proofs of concept, or design sessions\n` +
    `- Sign-offs, approvals, or vendor agreements required\n` +
    `- Dependencies that must be confirmed with external parties\n\n` +
    `RULES:\n` +
    `- Ground every action in what was actually discussed.\n` +
    `- Use professional, formal language suitable for a BRD action register.\n` +
    `- Aim for 4–8 clear, actionable items.\n\n` +
    `Return JSON: { "actions": ["<formal action description>", ...] }`;

  const result  = await generateGroundedJSON(prompt, sourceContext, 800);
  const actions = Array.isArray(result.actions)
    ? result.actions
    : rawItems.slice(0, 6).map((a) => cleanToRequirement(a));
  return actions.map((desc, i) => ({
    id:          `A-${String(i + 1).padStart(3, "0")}`,
    description: typeof desc === "string" ? desc : String(desc),
    status:      "Open",
  }));
}

// ─── Goals generation (AI-grounded) ──────────────────────────────────────────
async function generateGoalsFromContext(sourceContext, requestInfo) {
  const prompt =
    `From the source project discussion and documents, identify the key BUSINESS GOALS for this project.\n\n` +
    `Write 4–6 specific, measurable business goals that:\n` +
    `1. Are directly grounded in what was discussed or described in the problem statement\n` +
    `2. Describe measurable BUSINESS OUTCOMES, not technical deliverables\n` +
    `3. Are specific enough that success can be verified at project completion\n` +
    `4. Cover the primary value this project delivers to the organisation\n\n` +
    `RULES:\n` +
    `- Use ONLY goals clearly stated or implied in the discussion.\n` +
    `- If specific metrics or targets were mentioned, include them verbatim.\n` +
    `- Start each goal with an action verb (Eliminate, Reduce, Enable, Achieve, Automate, Deliver, etc.).\n` +
    `- Do NOT write vague goals like "improve efficiency" without specifics from the discussion.\n\n` +
    `Return JSON: { "goals": ["<specific business goal statement>", ...] }`;

  const result = await generateGroundedJSON(prompt, sourceContext, 600);
  const goals  = Array.isArray(result.goals) ? result.goals : [];
  if (goals.length === 0) {
    const title = requestInfo.title || "this initiative";
    return [
      `Deliver the "${cap(title)}" capability as described in the stakeholder requirements`,
      `Fulfil all functional requirements defined in this document to stakeholder acceptance criteria`,
      `Ensure full compliance with all regulatory and governance requirements identified in the discussion`,
    ];
  }
  return goals;
}

// ─── Assumptions & Constraints generation (AI-grounded) ──────────────────────
async function generateAssumptionsConstraintsFromContext(sourceContext) {
  const prompt =
    `From the source project discussion and documents, identify project ASSUMPTIONS and CONSTRAINTS.\n\n` +
    `ASSUMPTIONS are things assumed to be true but not yet explicitly confirmed:\n` +
    `- Technical assumptions (infrastructure availability, platform capabilities, existing tools)\n` +
    `- Business assumptions (user behaviour, data volumes, usage patterns, stakeholder availability)\n` +
    `- External assumptions (vendor readiness, regulatory timelines, third-party dependencies)\n\n` +
    `CONSTRAINTS are hard limitations the project must operate within:\n` +
    `- Technical constraints (mandated technologies, existing system limitations, architecture rules)\n` +
    `- Business constraints (budget caps, hard deadlines, business process rules, phasing decisions)\n` +
    `- Regulatory constraints (compliance requirements, legal obligations, audit requirements)\n` +
    `- Resource constraints (team size, skill availability, access to stakeholders)\n` +
    `- Integration constraints (API limitations, data format restrictions, vendor contracts)\n\n` +
    `RULES:\n` +
    `- Only include items clearly evident from the discussion and documents.\n` +
    `- Be specific, not generic (reference actual project context).\n` +
    `- Aim for 3–5 assumptions and 3–5 constraints.\n\n` +
    `Return JSON: {\n` +
    `  "assumptions": ["<specific assumption>", ...],\n` +
    `  "constraints": ["<specific constraint>", ...]\n` +
    `}`;

  const result = await generateGroundedJSON(prompt, sourceContext, 700);
  return {
    assumptions: Array.isArray(result.assumptions) && result.assumptions.length > 0
      ? result.assumptions
      : ["All named stakeholders will be available for review and sign-off throughout the project lifecycle"],
    constraints: Array.isArray(result.constraints) && result.constraints.length > 0
      ? result.constraints
      : ["All development must align with the organisation's existing technology standards and infrastructure"],
  };
}

// ─── Scope narrative generation (AI-grounded) ────────────────────────────────
async function generateScopeNarrative(sourceContext, inScope, outScope, requestInfo) {
  const inScopeText  = inScope.map((s, i)  => `${i + 1}. ${s}`).join("\n");
  const outScopeText = outScope.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const title        = requestInfo.title || "this project";

  const prompt =
    `Write a professional 2–3 sentence scope summary for the BRD of "${cap(title)}".\n\n` +
    `Approved IN SCOPE items:\n${inScopeText || "(Derive from discussion)"}\n\n` +
    `Approved OUT OF SCOPE items:\n${outScopeText || "(None specified)"}\n\n` +
    `Write a concise, professional scope narrative that:\n` +
    `1. Describes what this project delivers at a high level\n` +
    `2. References the key in-scope functional areas\n` +
    `3. Notes major exclusions if relevant\n\n` +
    `Use ONLY the source context and the scope items listed above.\n` +
    `Scope Summary (2–3 sentences, no bullet points):`;

  const narrative = await generateGroundedText(prompt, sourceContext, 220);
  if (narrative.length > 40 && !narrative.includes("undefined")) return narrative;

  const areaCount = inScope.length;
  return (
    `This project delivers ${areaCount > 0 ? `${areaCount} core functional area${areaCount > 1 ? "s" : ""} as defined in the approved scope` : "the capability described in the stakeholder discussion"} for "${cap(title)}". ` +
    `All items listed as in-scope constitute the delivery boundary for this initiative. ` +
    (outScope.length > 0 ? `Capabilities listed as out-of-scope are explicitly excluded from this delivery phase.` : "")
  );
}

// ─── Functional requirements generation (AI-grounded, comprehensive) ─────────
async function buildFunctionalRequirementsFromContext(sourceContext, requirements) {
  const reqList = requirements.length > 0
    ? requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")
    : "(No pre-extracted requirements — derive entirely from the source discussion)";

  const prompt =
    `Pre-extracted requirements from the discussion:\n${reqList}\n\n` +
    `Based ONLY on the source discussion and documents above, generate comprehensive Functional Requirements.\n\n` +
    `Instructions:\n` +
    `1. Group related requirements into logical functional areas named after actual discussion content.\n` +
    `2. For each area, write a comprehensive multi-sentence "The system shall..." requirement covering all relevant aspects discussed.\n` +
    `3. Assign a MoSCoW priority based on explicit language in the discussion.\n` +
    `4. Write a clear business rationale (1–2 sentences) explaining WHY this requirement matters.\n` +
    `5. Define 2–3 specific, testable acceptance criteria per requirement.\n` +
    `6. Cite the verbatim message(s) that justify each requirement.\n\n` +
    `Return JSON: { "functional_requirements": [ {\n` +
    `  "title": "<functional area name from actual discussion>",\n` +
    `  "description": "<comprehensive The system shall... statement — multi-sentence if needed>",\n` +
    `  "rationale": "<1–2 sentences on the business value from the discussion>",\n` +
    `  "priority": "<Must Have | Should Have | Could Have | Won't Have>",\n` +
    `  "acceptance_criteria": ["<testable condition 1>", "<testable condition 2>", "<testable condition 3>"],\n` +
    `  "source_messages": ["<verbatim quote from discussion>"]\n` +
    `} ] }\n\n` +
    `Rules:\n` +
    `- Do NOT add functional areas not mentioned in the discussion.\n` +
    `- Every requirement must trace back to at least one actual message.\n` +
    `- Descriptions must be comprehensive — cover all aspects of that area as discussed.\n` +
    `- Acceptance criteria must be testable and specific, never vague.`;

  try {
    const res = await azureClient.chat.completions.create({
      model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:        [
        { role: "system", content: GROUNDING_SYSTEM },
        { role: "user",   content: `${sourceContext}\n\n${prompt}` },
      ],
      temperature:     0,
      response_format: { type: "json_object" },
      max_tokens:      2500,
    });

    const parsed = JSON.parse(res.choices[0].message.content || "{}");
    const items  = Array.isArray(parsed.functional_requirements) ? parsed.functional_requirements : [];

    return items.map((fr, i) => ({
      id:                  `FR-${String(i + 1).padStart(3, "0")}`,
      title:               fr.title              || `Functional Requirement ${i + 1}`,
      description:         fr.description        || "Not specified in the discussion.",
      rationale:           fr.rationale          || "",
      priority:            fr.priority           || "Must Have",
      acceptance_criteria: Array.isArray(fr.acceptance_criteria) ? fr.acceptance_criteria : [],
      source:              Array.isArray(fr.source_messages) ? fr.source_messages.join("; ") : "Key Stakeholder Discussion",
    }));
  } catch (err) {
    console.warn("[BRD Generator] Dynamic FR extraction failed:", err.message);
    const frs = [];
    for (const [i, req] of requirements.entries()) {
      const formal = await formaliseRequirement(req);
      frs.push({
        id:                  `FR-${String(i + 1).padStart(3, "0")}`,
        title:               formal.split(" ").slice(0, 8).join(" "),
        description:         formal,
        rationale:           "",
        priority:            moscowPriority(req),
        acceptance_criteria: [],
        source:              "Key Stakeholder Discussion",
      });
    }
    return frs;
  }
}

// ─── Executive summary generation (enhanced) ─────────────────────────────────
async function generateExecutiveSummary(requestInfo, sourceContext) {
  const submittedDate = requestInfo.created_at
    ? new Date(requestInfo.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "Not specified";

  const prompt =
    `Write a professional executive summary for this Business Requirements Document.\n\n` +
    `The summary must include ALL FOUR of these elements in 4–5 sentences:\n` +
    `1. The specific business problem or opportunity as described in the discussion\n` +
    `2. The proposed solution scope — what the system or initiative will deliver\n` +
    `3. The key business benefits or value this initiative will deliver to the organisation\n` +
    `4. Any critical dependencies, constraints, or success factors mentioned in the discussion\n\n` +
    `Use ${submittedDate} as the document date if referenced. Do NOT invent dates.\n` +
    `Use ONLY information from the source context. Write in formal, professional business language.\n` +
    `Executive Summary (4–5 sentences):`;

  const aiOut = await generateGroundedText(prompt, sourceContext, 400);
  if (aiOut.length > 60 && !aiOut.includes("undefined")) return aiOut;

  const title    = requestInfo.title    || "this initiative";
  const category = requestInfo.category || "General";
  const priority = requestInfo.priority || "Medium";
  return (
    `This Business Requirements Document defines the scope and functional requirements for the "${cap(title)}" initiative submitted on ${submittedDate}. ` +
    `The ${category} domain requirement has been raised at ${priority} priority to address the business need described by the stakeholder. ` +
    `Delivery of this initiative is expected to resolve the identified gaps and deliver measurable business value to the organisation. ` +
    `All requirements in this document have been derived from the stakeholder discussion and must be validated and approved before development commences.`
  );
}

// ─── Business objective generation (enhanced) ────────────────────────────────
async function generateObjective(requestInfo, sourceContext) {
  const prompt =
    `Write a SMART business objective for this project in 2–3 sentences.\n\n` +
    `The objective must be:\n` +
    `- Specific: clearly state what will be achieved\n` +
    `- Measurable: include how success will be measured (only if metrics were mentioned)\n` +
    `- Achievable: reflect the scope discussed\n` +
    `- Relevant: tied directly to the business problem described\n` +
    `- Time-bound: reference any timelines mentioned (omit if none discussed)\n\n` +
    `Use ONLY the business problem and success criteria from the source context.\n` +
    `Do NOT invent metrics, percentages, or targets not mentioned in the discussion.\n` +
    `Business Objective (2–3 sentences):`;

  const aiOut = await generateGroundedText(prompt, sourceContext, 250);
  if (aiOut.length > 30 && !aiOut.includes("undefined") && !/^(write|provide)/i.test(aiOut))
    return aiOut;

  const title    = requestInfo.title    || "this initiative";
  const category = requestInfo.category || "General";
  return (
    `To deliver the "${cap(title)}" capability as described by the stakeholder in the ${category} domain. ` +
    `Success will be measured by the fulfilment of all requirements defined in this document and formal acceptance by the stakeholder following user acceptance testing.`
  );
}

// ─── BRD Enhancement (from stakeholder feedback) ─────────────────────────────
export async function enhanceBRD(existingBrd, improvementComments, requestInfo) {
  const commentsText = improvementComments.map((c) => `${c.reviewer_name}: ${c.comment}`).join(". ");
  const ex   = existingBrd.sections;
  const meta = existingBrd.meta;

  const parts      = String(meta.version).split(".");
  const newVersion = `${parts[0]}.${parseInt(parts[1] ?? "0") + 1}`;
  const now        = new Date();
  const docId      = `BRD-${requestInfo.req_number || requestInfo.id}-v${newVersion}`;

  const execPrompt =
    `Revise this BRD executive summary based on stakeholder feedback.\n` +
    `Original: "${ex.executive_summary.text.slice(0, 300)}"\n` +
    `Feedback: "${commentsText.slice(0, 300)}"\n` +
    `Write an improved 4–5 sentence professional executive summary (problem, solution, benefits, response to feedback):`;
  const newExecSummary = await generateText(execPrompt, 280);

  const existingReqTexts = ex.functional_requirements.items.map((fr) => fr.description);
  const extractReqPrompt = `From these review comments, extract any NEW system requirements not already covered: "${commentsText}". List each briefly. If none, say "none".`;
  const extractedReqs    = await generateText(extractReqPrompt, 80);

  const allReqTexts = [...existingReqTexts];
  if (extractedReqs && extractedReqs.length > 10 && !/^none/i.test(extractedReqs)) {
    const newLines = extractedReqs.split(/[.;\n]/).map((s) => s.trim()).filter((s) => s.length > 15 && !/^(none|no new|already)/i.test(s));
    allReqTexts.push(...newLines.slice(0, 3));
  }

  const formalRequirements = [];
  for (const [i, req] of allReqTexts.entries()) {
    const isNew  = i >= existingReqTexts.length;
    const formal = await formaliseRequirement(req);
    formalRequirements.push({
      id:                  `FR-${String(i + 1).padStart(3, "0")}`,
      title:               ex.functional_requirements.items[i]?.title ?? formal.split(" ").slice(0, 8).join(" "),
      description:         formal,
      rationale:           ex.functional_requirements.items[i]?.rationale ?? "",
      priority:            moscowPriority(req),
      acceptance_criteria: ex.functional_requirements.items[i]?.acceptance_criteria ?? [],
      source:              isNew ? `Stakeholder Feedback (v${newVersion})` : ex.functional_requirements.items[i]?.source ?? "Key Conversation (Revised)",
    });
  }

  // Formalise new risks from stakeholder feedback using AI
  const newRisks = [...ex.risk_register.items];
  const feedbackRisks = improvementComments.filter((c) =>
    /risk|concern|problem|issue|challenge|gap|miss|fail|wrong|unclear/i.test(c.comment)
  );
  for (const [i, c] of feedbackRisks.entries()) {
    const isDup = newRisks.some((r) => r.description.toLowerCase().slice(0, 30) === c.comment.toLowerCase().slice(0, 30));
    if (!isDup) {
      const riskPrompt = `Convert this stakeholder concern into a formal professional 2-sentence risk statement: "${c.comment.slice(0, 200)}"`;
      const formalDesc = await generateText(riskPrompt, 120);
      const impactHigh = /critical|severe|major|significant|high|block|fatal/i.test(c.comment);
      newRisks.push({
        id:          `R-${String(ex.risk_register.items.length + i + 1).padStart(3, "0")}`,
        description: formalDesc || c.comment,
        impact:      impactHigh ? "High" : "Medium",
        probability: "Medium",
        mitigation:  `Review with stakeholder and assign a named owner for resolution before the next project milestone.`,
      });
    }
  }

  return {
    meta: {
      ...meta,
      doc_id:                    docId,
      version:                   newVersion,
      status:                    "Draft",
      generated_at:              now.toISOString(),
      effective_date:            now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      enhanced_from_version:     meta.version,
      enhancement_comment_count: improvementComments.length,
      ai_models:                 meta.ai_models,
    },
    sections: {
      ...ex,
      executive_summary: {
        ...ex.executive_summary,
        text: newExecSummary.length > 40 && !newExecSummary.includes("undefined")
          ? newExecSummary
          : `${ex.executive_summary.text} This version incorporates ${improvementComments.length} stakeholder review(s).`,
      },
      functional_requirements: { ...ex.functional_requirements, items: formalRequirements },
      risk_register:           { ...ex.risk_register, items: newRisks },
    },
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateBRD(
  analysis,
  requestInfo,
  messages         = [],
  documentText     = "",
  approvedWorkflow = null,
  approvedScope    = null,
  documentAnalysis = null
) {
  const now        = new Date();
  const versionNum = "0.1";
  const docId      = `BRD-${requestInfo.req_number || requestInfo.id || "DRAFT"}-v${versionNum}`;

  // Build the single source-of-truth context — includes structured document intelligence if available
  const sourceContext = buildFullSourceContext(messages, requestInfo, documentText, documentAnalysis);

  // Use BA-approved scope items from Stage 2 (most authoritative source)
  const inScope    = approvedScope?.in_scope    || [];
  const outOfScope = approvedScope?.out_of_scope || [];

  // Run all AI section generators in parallel for performance
  const [
    execSummary,
    objective,
    goals,
    formalRequirements,
    nfrs,
    businessRules,
    integrationRequirements,
    risks,
    actionItems,
    assumptionsConstraints,
    scopeNarrative,
  ] = await Promise.all([
    generateExecutiveSummary(requestInfo, sourceContext),
    generateObjective(requestInfo, sourceContext),
    generateGoalsFromContext(sourceContext, requestInfo),
    buildFunctionalRequirementsFromContext(sourceContext, analysis.key_requirements || []),
    generateNFRsFromContext(sourceContext),
    generateBusinessRulesFromContext(sourceContext),
    generateIntegrationRequirementsFromContext(sourceContext),
    generateRisksFromContext(sourceContext, analysis.stakeholder_concerns || []),
    generateActionItemsFromContext(sourceContext, analysis.action_items || []),
    generateAssumptionsConstraintsFromContext(sourceContext),
    generateScopeNarrative(sourceContext, inScope, outOfScope, requestInfo),
  ]);

  const { assumptions, constraints } = assumptionsConstraints;
  const stakeholders = extractStakeholders(messages, requestInfo);

  return {
    meta: {
      doc_id:          docId,
      version:         versionNum,
      status:          "Draft",
      request_id:      requestInfo.id,
      request_number:  requestInfo.req_number,
      title:           requestInfo.title,
      category:        requestInfo.category || "General",
      priority:        requestInfo.priority || "Medium",
      generated_at:    now.toISOString(),
      effective_date:  now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      ai_models:              [`Azure OpenAI ${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"} (grounded generation)`],
      source_messages:        analysis.message_count,
      documents_analyzed:     documentAnalysis ? (documentAnalysis.documents_analyzed || []).map((d) => d.name) : [],
      document_intelligence:  documentAnalysis != null,
    },
    sections: {
      executive_summary: {
        number: "1",
        title:  "Executive Summary",
        text:   execSummary,
      },
      objective: {
        number: "2",
        title:  "Business Objective & Goals",
        text:   objective,
        goals,
      },
      scope: {
        number:       "3",
        title:        "Scope",
        summary:      scopeNarrative,
        in_scope:     inScope.length > 0 ? inScope : ["Refer to approved scope definition"],
        out_of_scope: outOfScope,
        process_flow: approvedWorkflow?.steps || [],
      },
      assumptions_constraints: {
        number:      "4",
        title:       "Assumptions & Constraints",
        assumptions,
        constraints,
      },
      stakeholders: {
        number: "5",
        title:  "Stakeholder Analysis",
        list:   stakeholders,
      },
      functional_requirements: {
        number: "6",
        title:  "Functional Requirements",
        items:  formalRequirements,
      },
      non_functional_requirements: {
        number: "7",
        title:  "Non-Functional Requirements",
        items:  nfrs,
      },
      business_rules: {
        number: "8",
        title:  "Business Rules",
        items:  businessRules,
      },
      integration_requirements: {
        number: "9",
        title:  "Integration Requirements",
        items:  integrationRequirements,
      },
      risk_register: {
        number: "10",
        title:  "Risk Register",
        items:  risks,
      },
      action_items: {
        number: "11",
        title:  "Action Items & Next Steps",
        items:  actionItems,
      },
      brd_readiness: {
        number: "12",
        title:  "BRD Readiness Assessment",
        ...analysis.brd_readiness,
      },
      appendix: {
        title:    "Appendix A: Key Conversation Excerpts",
        messages: messages.map((m) => ({ sender: m.sender_name, text: m.message_text, marked_at: m.marked_at })),
        keywords: analysis.keywords,
      },
    },
  };
}
