/**
 * BRD Generator — Advanced AI document generation engine.
 *
 * Pipeline:
 *  1. Flan-T5 (text2text-generation) — executive summary + objective
 *  2. Formal requirement rewriting   — "The system shall…" pattern
 *  3. MoSCoW prioritisation          — deterministic pattern matching
 *  4. NFR inference                  — expanded to cover Performance, Security,
 *                                       Compliance, Storage, and 5 more categories
 *  5. Business rules extraction      — derived from requirement + domain text
 *  6. Integration requirements       — derived from integration_signals metadata
 *  7. Risk matrix                    — impact/probability + mitigation
 *  8. Scope inference                — in/out of scope from requirements
 *  9. Full JSON BRD assembly         — numbered sections, IDs, version metadata
 */

import { pipeline, env } from "@xenova/transformers";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
env.cacheDir = join(__dirname, "../../models");
env.allowLocalModels = true;

const GEN_MODEL = "Xenova/flan-t5-small";

let _generator  = null;
let _genPromise = null;

async function getGenerator() {
  if (_generator) return _generator;
  if (_genPromise) return _genPromise;
  _genPromise = (async () => {
    console.log("[BRD Generator] Loading Flan-T5-small…");
    _generator = await pipeline("text2text-generation", GEN_MODEL, { quantized: true });
    console.log("[BRD Generator] Flan-T5 ready.");
    return _generator;
  })();
  return _genPromise;
}

// ─── MoSCoW ───────────────────────────────────────────────────────────────────
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

// ─── NFR inference — expanded ─────────────────────────────────────────────────
const NFR_PATTERNS = [
  { re: /\b(fast|quick|speed|response time|latency|performance|throughput|efficient|\d+\s*second[s]?|within \d+)\b/i,
    category: "Performance",
    desc: "System response times shall meet agreed SLA targets. API calls shall complete within the specified time window." },
  { re: /\b(secure|security|authentication|authoris|encrypt|access control|permission|role|api key|tls|https)\b/i,
    category: "Security",
    desc: "All data access shall be authenticated and sensitive financial data encrypted in transit and at rest." },
  { re: /\b(uptime|availability|24.7|always on|reliable|disaster|failover|backup)\b/i,
    category: "Availability",
    desc: "System availability shall meet the agreed uptime SLA (>99.5%)." },
  { re: /\b(scale|scalab|load|concurrent|users|traffic|grow)\b/i,
    category: "Scalability",
    desc: "System shall scale horizontally to support projected user growth." },
  { re: /\b(audit|log|track|monitor|compliance|regulatory|gdpr|legal)\b/i,
    category: "Compliance & Audit",
    desc: "All user actions shall be logged for compliance and audit purposes." },
  { re: /\b(consent|customer consent|permission|authoris|approval before|mandatory consent)\b/i,
    category: "Regulatory Compliance & Consent",
    desc: "Explicit customer consent shall be obtained and recorded before any personal or financial data is fetched or processed." },
  { re: /\b(store only|summary only|not store|derived|store.*summary|sensitive.*not.*store|no.*full.*statement)\b/i,
    category: "Data Storage & Privacy",
    desc: "Only derived financial summary values shall be stored. Raw bank statements and full transaction data shall not be persisted after processing." },
  { re: /\b(mobile|responsive|device|tablet|phone|browser|cross.platform)\b/i,
    category: "Usability",
    desc: "Interface shall be responsive and accessible across modern browsers and devices." },
  { re: /\b(integrat|api|third.?party|connect|sync|interface|webhook|aggregator)\b/i,
    category: "Interoperability",
    desc: "System shall provide documented APIs and support third-party integration contracts." },
  { re: /\b(maintain|support|update|patch|upgr|version)\b/i,
    category: "Maintainability",
    desc: "System shall be modular to enable independent updates and patching." },
];

function inferNFRs(allText, complianceSignals = {}) {
  const seen = new Set();
  const nfrs = [];

  NFR_PATTERNS.forEach(({ re, category, desc }) => {
    let matches = re.test(allText);

    // Force Consent NFR if compliance signals detected
    if (category === "Regulatory Compliance & Consent" && complianceSignals.consent_required) matches = true;
    // Force Storage NFR if signals detected
    if (category === "Data Storage & Privacy" && complianceSignals.storage_restricted) matches = true;

    if (matches && !seen.has(category)) {
      seen.add(category);
      nfrs.push({ category, description: desc });
    }
  });

  return nfrs;
}

// ─── Business rules extraction ────────────────────────────────────────────────
/**
 * Derives explicit business rules from requirement text and domain signals.
 * Rules are deterministic and traceable to source discussion text.
 */
const BUSINESS_RULE_PATTERNS = [
  { re: /6 month|six month|last 6|minimum.*month|month.*minimum/i,
    rule: "A minimum of 6 months of bank statement history is required for income assessment." },
  { re: /salary.*narration|narration.*salary|narration format|identify.*salary|salary.*identif/i,
    rule: "Salary credit narration patterns shall be matched across all major bank formats to correctly identify salary transactions." },
  { re: /average.*income|income.*average|average.*salary|average.*credit/i,
    rule: "Average monthly income shall be calculated from salary credits over the most recent 6-month period." },
  { re: /not detected|salary not|no salary|manual review|manual underwr/i,
    rule: "Cases where salary income cannot be automatically detected shall be routed to a human underwriter for manual review." },
  { re: /irregular|inconsistent|sudden drop|drop in salary|irregular pattern/i,
    rule: "Irregular income patterns (e.g. sudden salary drops, inconsistent credits) shall be flagged and assigned to the risk review queue." },
  { re: /bounced|bounce|cheque bounce|neft bounce/i,
    rule: "Cheque and NEFT bounce incidents shall be counted and used as a negative credit signal." },
  { re: /emi|obligation|loan obligation|existing loan/i,
    rule: "Existing EMI obligations identified in transactions shall be deducted from net income for eligibility calculation." },
  { re: /cash deposit|high.*cash|suspicious.*cash|large.*deposit/i,
    rule: "High-value cash deposits within 90 days of loan application shall be flagged for fraud review." },
  { re: /consent|customer consent|permission.*fetch|fetch.*permission/i,
    rule: "Customer explicit consent must be captured and stored before any bank statement data is fetched or processed." },
  { re: /store.*summary|summary.*store|not.*full.*statement|only.*derived/i,
    rule: "Only derived summary values (income average, EMI total, bounce count) shall be stored. Raw statement data must not be persisted." },
  { re: /api.*response|response.*time|8.*second|10.*second|\d+.*second.*api/i,
    rule: "Third-party API calls shall complete within the agreed response time window. Timeouts shall trigger a fallback or error notification." },
  { re: /pdf.*initially|initially.*pdf|support.*pdf|pdf.*support/i,
    rule: "PDF is the initially supported bank statement format. Net banking fetch may be introduced in a future phase." },
];

function extractBusinessRules(allText) {
  const seen = new Set();
  const rules = [];
  BUSINESS_RULE_PATTERNS.forEach(({ re, rule }) => {
    if (re.test(allText) && !seen.has(rule)) {
      seen.add(rule);
      rules.push(rule);
    }
  });
  // Always include at least these two universal rules
  if (!rules.some((r) => /audit/i.test(r)))
    rules.push("All state-changing operations shall be recorded in an immutable audit log.");
  if (!rules.some((r) => /validation/i.test(r)))
    rules.push("All business logic shall be validated server-side regardless of client-side validation.");
  return rules;
}

// ─── Integration requirements builder ────────────────────────────────────────
/**
 * Builds a structured integration_requirements section from the
 * integration_signals extracted by the BRD agent.
 */
function buildIntegrationRequirements(integrationSignals = {}) {
  const items = [];
  if (!integrationSignals || !integrationSignals.has_api_integration) return items;

  const { input_formats = [], output_formats = [], vendors = [], auth_type, api_response_time } = integrationSignals;

  // Primary third-party API integration
  items.push({
    id:          "INT-001",
    type:        "REST API",
    system:      vendors.length ? vendors[0] : "Third-Party Statement Parsing API",
    direction:   "Outbound",
    input:       input_formats.join(" / ") || "PDF Document",
    output:      output_formats.join(" / ") || "JSON Structured Data",
    auth:        auth_type || "Secure API Key",
    sla:         api_response_time ? `Response within ${api_response_time}` : "Response within agreed SLA",
    description: `Integrate with ${vendors.length ? vendors[0] : "a third-party statement parsing API"} to parse bank statement documents and return structured transaction data.`,
  });

  // Fallback / additional vendor if multiple detected
  if (vendors.length > 1) {
    items.push({
      id:          "INT-002",
      type:        "REST API",
      system:      vendors[1],
      direction:   "Outbound",
      input:       input_formats.join(" / ") || "PDF Document",
      output:      output_formats.join(" / ") || "JSON Structured Data",
      auth:        auth_type || "Secure API Key",
      sla:         api_response_time ? `Response within ${api_response_time}` : "Response within agreed SLA",
      description: `Alternate integration with ${vendors[1]} as a fallback statement parsing provider.`,
    });
  }

  // Inbound document upload API if PDF detected
  if (input_formats.includes("PDF")) {
    items.push({
      id:          `INT-00${items.length + 1}`,
      type:        "File Upload",
      system:      "Document Upload Service",
      direction:   "Inbound",
      input:       "PDF (max 6 months of statements)",
      output:      "Stored document reference + parsed transaction JSON",
      auth:        "JWT Bearer Token (customer session)",
      sla:         "Upload processing < 30 seconds",
      description: "Customer-facing file upload endpoint that accepts PDF bank statements, validates file size and format, and triggers parsing.",
    });
  }

  return items;
}

// ─── Risk matrix ──────────────────────────────────────────────────────────────
const HIGH_IMPACT_RE = /\b(critical|severe|major|significant|high|catastrophic|fatal|block|stop)\b/i;
const LOW_IMPACT_RE  = /\b(minor|small|low|minimal|trivial|slight)\b/i;
const HIGH_PROB_RE   = /\b(certain|likely|probably|common|frequent|often|expected|anticipated)\b/i;
const LOW_PROB_RE    = /\b(unlikely|rare|seldom|infrequent|exceptional)\b/i;

function assessRisk(text) {
  const impact      = HIGH_IMPACT_RE.test(text) ? "High" : LOW_IMPACT_RE.test(text) ? "Low" : "Medium";
  const probability = HIGH_PROB_RE.test(text)   ? "High" : LOW_PROB_RE.test(text)   ? "Low" : "Medium";
  return { impact, probability };
}

const MITIGATION_MAP = {
  performance:  "Conduct early load testing; define SLA benchmarks; cache API responses where appropriate.",
  security:     "Engage security team for threat modelling; implement OWASP guidelines; encrypt all PII at rest.",
  integration:  "Prototype integration in discovery phase; agree API contracts and SLAs with vendor early.",
  data:         "Define data governance policy; implement field-level encryption for financial data.",
  timeline:     "Break work into milestones; flag blockers in weekly stand-ups.",
  requirement:  "Schedule follow-up requirement workshops to clarify ambiguities.",
  stakeholder:  "Establish regular stakeholder review cadence (bi-weekly check-ins).",
  resource:     "Identify resource gaps early; escalate to project sponsor if needed.",
  technical:    "Spike technical unknowns in early sprints; document architecture decisions.",
  compliance:   "Engage legal/compliance team for consent framework review before implementation.",
  fraud:        "Define fraud detection thresholds with the risk team; include in UAT scope.",
  manual:       "Design manual review queue UX with operations team; define SLA for manual cases.",
};

function deriveMitigation(text) {
  const lower = text.toLowerCase();
  for (const [keyword, mitigation] of Object.entries(MITIGATION_MAP)) {
    if (lower.includes(keyword)) return mitigation;
  }
  return "Assign a risk owner; monitor at each sprint review and escalate if threshold is breached.";
}

// ─── Scope inference ──────────────────────────────────────────────────────────
const SCOPE_EXCLUDE_RE = /\b(not included|out of scope|excluded|won't|will not|future|phase 2|next release|later|deferred)\b/i;
const DEFAULT_OOS = [
  "Net banking fetch integration (deferred to Phase 2)",
  "Full bank statement storage (only derived summary values stored)",
  "Third-party credit bureau integration (separate initiative)",
  "Mobile native application (web-responsive only in Phase 1)",
];

function extractOutOfScope(requirements, concerns) {
  const oos = [];
  [...requirements, ...concerns].forEach((item) => {
    if (SCOPE_EXCLUDE_RE.test(item)) oos.push(item);
  });
  return oos.length ? oos : DEFAULT_OOS.slice(0, 3);
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
  if (requestInfo.stakeholder_name && !names.has(requestInfo.stakeholder_name)) {
    list.unshift({ name: requestInfo.stakeholder_name, role: "Primary Stakeholder / Business Owner" });
  }
  list.push({ name: "Business Analyst",   role: "BRD Author / Requirements Owner" });
  list.push({ name: "IT Implementation",  role: "Technical Feasibility & Implementation" });
  return list;
}

function cap(str = "") { return str.charAt(0).toUpperCase() + str.slice(1); }

// ─── Text cleaner ─────────────────────────────────────────────────────────────
function cleanToRequirement(raw) {
  let text = String(raw)
    .replace(/^(next step[s]?[:\s,]*|understood[.\s,]*|noted[.\s,]*|agreed[.\s,]*|sure[,\s]+|ok[ay]*[,.\s]+|thanks?[,.\s]+|do we have[^?]*\??\s*)/i, "")
    .replace(/^(from (my|our|the) (side|end|perspective)[,:\s]*)/i, "")
    .replace(/\b(I've|we've|I'll|we'll|I'm|we're)\b/gi, "the team")
    .replace(/\b(I |me |my |we |us |our )\b/gi, "the organisation ")
    .replace(/^(also\s+)?(noticing|noticed|aware that|seeing that)\s+/i, "There are ")
    .replace(/\?$/, "").replace(/\s+/g, " ").trim();
  if (text.length < 10) text = raw.trim();
  return cap(text);
}

// ─── Flan-T5 text generation ──────────────────────────────────────────────────
async function generateText(prompt, maxTokens = 120) {
  try {
    const gen = await getGenerator();
    const [result] = await gen(prompt, { max_new_tokens: maxTokens, num_beams: 4, early_stopping: true, no_repeat_ngram_size: 3 });
    return result.generated_text?.trim() || "";
  } catch (err) {
    console.warn("[BRD Generator] Flan-T5 generation failed:", err.message);
    return "";
  }
}

// ─── Formal requirement rewriter ─────────────────────────────────────────────
async function formaliseRequirement(text) {
  const cleaned = cleanToRequirement(text);
  if (/^the system shall/i.test(cleaned)) return cap(cleaned);

  const prompt = `Rewrite as a concise formal business system requirement starting with "The system shall". Input: ${cleaned.slice(0, 180)}`;
  const out    = await generateText(prompt, 80);
  if (out.length > 15 && /^The system shall/i.test(out) && out.length < 300 && !out.toLowerCase().startsWith(cleaned.slice(0, 20).toLowerCase())) {
    return cap(out);
  }

  const core = cleaned
    .replace(/^(vendor costs have (gone up|increased)|costs have (gone up|increased))/i, "track and manage vendor costs that have increased")
    .replace(/^(inefficien(cy|cies) in|some inefficien)/i, "identify and resolve inefficiencies in")
    .replace(/^(there are (some\s+)?)/i, "");

  return `The system shall ${core.charAt(0).toLowerCase() + core.slice(1)}`;
}

// ─── Executive summary ────────────────────────────────────────────────────────
async function generateExecutiveSummary(analysis, requestInfo) {
  const cleanedReqs = (analysis.key_requirements || []).slice(0, 3).map(cleanToRequirement).filter((r) => r.length > 8);
  const keywords    = (analysis.keywords || []).slice(0, 6).join(", ");
  const domain      = requestInfo.category || "General";
  const title       = requestInfo.title || "this initiative";
  const priority    = (requestInfo.priority || "Medium").toLowerCase();

  const prompt =
    `Write a 2-sentence professional executive summary for a Business Requirements Document.\n` +
    `Project: "${title}". Domain: ${domain}. Priority: ${priority}.\n` +
    `Key topics: ${keywords || domain}.\nExecutive Summary:`;

  const out = await generateText(prompt, 120);
  if (out.length > 40 && !out.includes("undefined") && !out.includes(prompt.slice(0, 20))) return out;

  const focus = cleanedReqs.length
    ? cleanedReqs[0].charAt(0).toLowerCase() + cleanedReqs[0].slice(1)
    : `${domain.toLowerCase()} operational improvements`;

  return (
    `This Business Requirements Document defines the functional and non-functional requirements ` +
    `for the "${cap(title)}" initiative within the ${domain} domain. ` +
    `The project focuses on ${focus}, with ${priority} priority to deliver measurable business outcomes and ` +
    `${keywords ? `improvements in ${keywords}` : "operational efficiency gains"}.`
  );
}

// ─── Business objective ───────────────────────────────────────────────────────
async function generateObjective(analysis, requestInfo) {
  const domain   = requestInfo.category || "General";
  const title    = requestInfo.title || "this initiative";
  const priority = (requestInfo.priority || "Medium").toLowerCase();
  const keywords = (analysis.keywords || []).slice(0, 4).join(", ");

  const prompt =
    `Write a 2-sentence business objective statement.\n` +
    `Project: "${title}". Domain: ${domain}. Priority: ${priority}.\n` +
    `State the business purpose and the expected measurable outcome.\nObjective:`;

  const out = await generateText(prompt, 90);
  if (out.length > 30 && !out.includes("undefined") && !out.includes(prompt.slice(0, 20))) return out;

  return (
    `To deliver a comprehensive solution that addresses the identified ${domain.toLowerCase()} ` +
    `business challenges outlined in the "${cap(title)}" initiative, with ${priority} priority focus. ` +
    `This initiative aims to improve ${keywords || domain.toLowerCase() + " efficiency"}, ` +
    `reduce operational costs, and provide measurable business value aligned with organisational goals.`
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
    `Revise this Business Requirements Document executive summary based on stakeholder feedback.\n` +
    `Original: "${ex.executive_summary.text.slice(0, 300)}"\n` +
    `Feedback: "${commentsText.slice(0, 300)}"\n` +
    `Write an improved 2-sentence professional executive summary:`;
  const newExecSummary = await generateText(execPrompt, 120);

  const existingReqTexts = ex.functional_requirements.items.map((fr) => fr.original || fr.description);
  const extractReqPrompt = `From these stakeholder review comments, extract any new system requirements or changes needed: "${commentsText}". List each as a brief requirement. If none, say "none".`;
  const extractedReqs    = await generateText(extractReqPrompt, 80);

  const allReqTexts = [...existingReqTexts];
  if (extractedReqs && extractedReqs.length > 10 && !/^none/i.test(extractedReqs)) {
    const newLines = extractedReqs.split(/[.;\n]/).map((s) => s.trim()).filter((s) => s.length > 15 && !/^(none|no new|already)/i.test(s));
    allReqTexts.push(...newLines.slice(0, 3));
  }

  const formalRequirements = [];
  for (const [i, req] of allReqTexts.entries()) {
    const formal = await formaliseRequirement(req);
    const isNew  = i >= existingReqTexts.length;
    formalRequirements.push({
      id:          `FR-${String(i + 1).padStart(3, "0")}`,
      description: formal,
      priority:    moscowPriority(req),
      source:      isNew ? `Stakeholder Feedback (v${newVersion})` : ex.functional_requirements.items[i]?.source ?? "Key Conversation (Revised)",
      original:    cap(req),
    });
  }

  const newRisks = [...ex.risk_register.items];
  improvementComments
    .filter((c) => /risk|concern|problem|issue|challenge|gap|miss|fail|wrong|unclear/i.test(c.comment))
    .forEach((c, i) => {
      const isDup = newRisks.some((r) => r.description.toLowerCase().slice(0, 30) === c.comment.toLowerCase().slice(0, 30));
      if (!isDup) {
        const { impact, probability } = assessRisk(c.comment);
        newRisks.push({ id: `R-${String(ex.risk_register.items.length + i + 1).padStart(3, "0")}`, description: cap(c.comment), impact, probability, mitigation: deriveMitigation(c.comment) });
      }
    });

  const allText = [...allReqTexts, commentsText].join(" ");
  const nfrs    = inferNFRs(allText).map((nfr, i) => ({ id: `NFR-${String(i + 1).padStart(3, "0")}`, ...nfr }));

  return {
    meta: {
      ...meta,
      doc_id: docId, version: newVersion, status: "Draft", generated_at: now.toISOString(),
      effective_date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      enhanced_from_version: meta.version, enhancement_comment_count: improvementComments.length, ai_models: meta.ai_models,
    },
    sections: {
      ...ex,
      executive_summary: { ...ex.executive_summary, text: newExecSummary.length > 40 && !newExecSummary.includes("undefined") ? newExecSummary : `${ex.executive_summary.text} This version incorporates ${improvementComments.length} stakeholder review(s).` },
      scope:                    { ...ex.scope, in_scope: formalRequirements.map((r) => r.original) },
      functional_requirements:  { ...ex.functional_requirements, items: formalRequirements },
      non_functional_requirements: { ...ex.non_functional_requirements, items: nfrs },
      risk_register:            { ...ex.risk_register, items: newRisks },
    },
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateBRD(analysis, requestInfo, messages = []) {
  const now        = new Date();
  const versionNum = "0.1";
  const docId      = `BRD-${requestInfo.req_number || requestInfo.id || "DRAFT"}-v${versionNum}`;

  const allReqText     = [...(analysis.key_requirements || []), ...(analysis.action_items || [])].join(" ");
  const allConcernText = (analysis.stakeholder_concerns || []).join(" ");
  const allMsgText     = messages.map((m) => m.message_text).join(" ");
  const allText        = `${allReqText} ${allConcernText} ${allMsgText}`;

  // Integration and compliance signals from the agent
  const integrationSignals = analysis.integration_signals || {};
  const complianceSignals  = analysis.compliance_signals  || {};

  // ── Parallel AI tasks ────────────────────────────────────────────────────
  const [execSummary, objective] = await Promise.all([
    generateExecutiveSummary(analysis, requestInfo),
    generateObjective(analysis, requestInfo),
  ]);

  // ── Formal functional requirements ───────────────────────────────────────
  const formalRequirements = [];
  for (const [i, req] of (analysis.key_requirements || []).entries()) {
    const formal = await formaliseRequirement(req);
    formalRequirements.push({
      id:          `FR-${String(i + 1).padStart(3, "0")}`,
      description: formal,
      priority:    moscowPriority(req),
      source:      "Key Conversation",
      original:    cap(req),
    });
  }

  // ── NFRs (expanded) ──────────────────────────────────────────────────────
  const nfrs = inferNFRs(allText, complianceSignals).map((nfr, i) => ({
    id: `NFR-${String(i + 1).padStart(3, "0")}`,
    ...nfr,
  }));

  // ── Business Rules ───────────────────────────────────────────────────────
  const businessRules = extractBusinessRules(allText).map((rule, i) => ({
    id:          `BR-${String(i + 1).padStart(3, "0")}`,
    description: rule,
  }));

  // ── Integration Requirements ─────────────────────────────────────────────
  const integrationRequirements = buildIntegrationRequirements(integrationSignals);

  // ── Risk register ────────────────────────────────────────────────────────
  const risks = (analysis.stakeholder_concerns || []).map((concern, i) => {
    const { impact, probability } = assessRisk(concern);
    return { id: `R-${String(i + 1).padStart(3, "0")}`, description: cap(concern), impact, probability, mitigation: deriveMitigation(concern) };
  });

  // ── Scope ────────────────────────────────────────────────────────────────
  const inScope    = formalRequirements.map((r) => r.original);
  const outOfScope = extractOutOfScope(analysis.key_requirements || [], analysis.stakeholder_concerns || []);

  // ── Stakeholders ─────────────────────────────────────────────────────────
  const stakeholders = extractStakeholders(messages, requestInfo);

  // ── Action items ─────────────────────────────────────────────────────────
  const actionItems = (analysis.action_items || []).map((item, i) => ({
    id:          `A-${String(i + 1).padStart(3, "0")}`,
    description: cap(item),
    status:      "Open",
  }));

  // ── Goals ────────────────────────────────────────────────────────────────
  const goals = (analysis.key_requirements || [])
    .slice(0, 4)
    .map((r) => cleanToRequirement(r).replace(/^(the system shall|must|should|need to)\s*/i, ""))
    .map(cap);

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
      ai_models:       ["Xenova/nli-deberta-v3-small (zero-shot classification)", "Xenova/flan-t5-small (text generation)"],
      source_messages: analysis.message_count,
    },
    sections: {
      executive_summary: { number: "1", title: "Executive Summary", text: execSummary },
      objective: { number: "2", title: "Business Objective & Goals", text: objective, goals },
      scope:     { number: "3", title: "Scope", in_scope: inScope, out_of_scope: outOfScope },
      stakeholders: { number: "4", title: "Stakeholder Analysis", list: stakeholders },
      functional_requirements: { number: "5", title: "Functional Requirements", items: formalRequirements },
      non_functional_requirements: { number: "6", title: "Non-Functional Requirements", items: nfrs },
      business_rules: { number: "7", title: "Business Rules", items: businessRules },
      integration_requirements: { number: "8", title: "Integration Requirements", items: integrationRequirements },
      risk_register: { number: "9", title: "Risk Register", items: risks },
      action_items:  { number: "10", title: "Action Items & Next Steps", items: actionItems },
      brd_readiness: { number: "11", title: "BRD Readiness Assessment", ...analysis.brd_readiness },
      appendix: {
        title:    "Appendix A: Key Conversation Excerpts",
        messages: messages.map((m) => ({ sender: m.sender_name, text: m.message_text, marked_at: m.marked_at })),
        keywords: analysis.keywords,
      },
    },
  };
}
