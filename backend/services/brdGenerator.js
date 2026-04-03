/**
 * BRD Generator — Advanced AI document generation engine.
 *
 * Pipeline:
 *  1. Flan-T5 (text2text-generation) — generates the executive summary paragraph
 *     and expands each requirement into a formal business statement.
 *  2. Pattern-based MoSCoW prioritisation — Must / Should / Could / Won't
 *  3. NFR inference — infers non-functional requirements from requirement text
 *  4. Risk matrix — derives impact, probability and mitigation from concern text
 *  5. Scope inference — separates in-scope (explicit) from out-of-scope (absent patterns)
 *  6. Structured JSON assembly — numbered sections, IDs, version metadata
 */

import { pipeline, env } from "@xenova/transformers";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
env.cacheDir = join(__dirname, "../../models");
env.allowLocalModels = true;

const GEN_MODEL = "Xenova/flan-t5-small"; // Memory-safe for cloud hosting

let _generator = null;
let _genPromise = null;

async function getGenerator() {
  if (_generator) return _generator;
  if (_genPromise) return _genPromise;
  _genPromise = (async () => {
    console.log("[BRD Generator] Loading Flan-T5-small text generation model…");
    _generator = await pipeline("text2text-generation", GEN_MODEL, { quantized: true });
    console.log("[BRD Generator] Flan-T5 ready.");
    return _generator;
  })();
  return _genPromise;
}
// Model is loaded lazily on first BRD generation request — not on server start.

// ─── MoSCoW priority classification ──────────────────────────────────────────
const MUST_RE   = /\b(must|critical|mandatory|required|essential|shall|has to|need to|necessary)\b/i;
const SHOULD_RE = /\b(should|important|ideally|recommended|desired|expected)\b/i;
const COULD_RE  = /\b(could|nice to have|optional|consider|may|might|possible)\b/i;
const WONT_RE   = /\b(won't|will not|out of scope|future|later|phase 2|not in scope)\b/i;

function moscowPriority(text) {
  if (WONT_RE.test(text))   return "Won't Have";
  if (MUST_RE.test(text))   return "Must Have";
  if (SHOULD_RE.test(text)) return "Should Have";
  if (COULD_RE.test(text))  return "Could Have";
  return "Must Have"; // default for requirements
}

// ─── NFR inference ────────────────────────────────────────────────────────────
const NFR_PATTERNS = [
  { re: /\b(fast|quick|speed|response time|latency|performance|throughput|efficient)\b/i, category: "Performance",   desc: "System response times shall meet agreed SLA targets." },
  { re: /\b(secure|security|authentication|authoris|encrypt|access control|permission|role)\b/i, category: "Security", desc: "All data access shall be authenticated and encrypted in transit." },
  { re: /\b(uptime|availability|24.7|always on|reliable|disaster|failover|backup)\b/i, category: "Availability", desc: "System availability shall meet the agreed uptime SLA (>99.5%)." },
  { re: /\b(scale|scalab|load|concurrent|users|traffic|grow)\b/i, category: "Scalability", desc: "System shall scale horizontally to support projected user growth." },
  { re: /\b(audit|log|track|monitor|compliance|regulatory|gdpr|legal)\b/i, category: "Compliance & Audit", desc: "All user actions shall be logged for compliance and audit purposes." },
  { re: /\b(mobile|responsive|device|tablet|phone|browser|cross.platform)\b/i, category: "Usability", desc: "Interface shall be responsive and accessible across modern browsers and devices." },
  { re: /\b(integrat|api|third.party|connect|sync|interface|webhook)\b/i, category: "Interoperability", desc: "System shall provide documented APIs for third-party integrations." },
  { re: /\b(maintain|maintain|support|update|patch|upgr|version)\b/i, category: "Maintainability", desc: "System shall be modular to enable independent updates and patching." },
];

function inferNFRs(allText) {
  const seen = new Set();
  const nfrs = [];
  NFR_PATTERNS.forEach(({ re, category, desc }) => {
    if (re.test(allText) && !seen.has(category)) {
      seen.add(category);
      nfrs.push({ category, description: desc });
    }
  });
  return nfrs;
}

// ─── Risk matrix ──────────────────────────────────────────────────────────────
const HIGH_IMPACT_RE = /\b(critical|severe|major|significant|high|catastrophic|fatal|block|stop)\b/i;
const LOW_IMPACT_RE  = /\b(minor|small|low|minimal|trivial|slight)\b/i;

const HIGH_PROB_RE = /\b(certain|likely|probably|common|frequent|often|expected|anticipated)\b/i;
const LOW_PROB_RE  = /\b(unlikely|rare|seldom|infrequent|exceptional)\b/i;

function assessRisk(text) {
  const impact     = HIGH_IMPACT_RE.test(text) ? "High" : LOW_IMPACT_RE.test(text) ? "Low" : "Medium";
  const probability = HIGH_PROB_RE.test(text) ? "High" : LOW_PROB_RE.test(text) ? "Low" : "Medium";
  return { impact, probability };
}

const MITIGATION_MAP = {
  "performance":    "Conduct early load testing; define performance benchmarks in sprint 1.",
  "security":       "Engage security team for threat modelling; implement OWASP guidelines.",
  "integration":    "Prototype integration in discovery phase; agree API contracts early.",
  "data":           "Define data governance policy; implement validation at system boundaries.",
  "timeline":       "Break work into milestones; flag blockers in weekly stand-ups.",
  "requirement":    "Schedule follow-up requirement workshops to clarify ambiguities.",
  "stakeholder":    "Establish regular stakeholder review cadence (bi-weekly check-ins).",
  "resource":       "Identify resource gaps early; escalate to project sponsor if needed.",
  "technical":      "Spike technical unknowns in early sprints; document architecture decisions.",
  "compliance":     "Engage legal/compliance team for review before implementation begins.",
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
  "Third-party integrations beyond those explicitly listed",
  "Data migration from legacy systems (unless specified)",
  "Reporting and analytics dashboards (Phase 2)",
  "Mobile native application (web responsive only in this phase)",
];

function extractOutOfScope(requirements, concerns) {
  const oos = [];
  [...requirements, ...concerns].forEach((item) => {
    if (SCOPE_EXCLUDE_RE.test(item)) oos.push(item);
  });
  return oos.length ? oos : DEFAULT_OOS.slice(0, 2);
}

// ─── Stakeholder extraction ───────────────────────────────────────────────────
function extractStakeholders(messages, requestInfo) {
  const names = new Set();
  messages.forEach((m) => { if (m.sender_name) names.add(m.sender_name); });
  const list = [...names].map((name) => ({
    name,
    role: name === requestInfo.stakeholder_name ? "Primary Stakeholder / Business Owner" : "Discussion Participant",
  }));
  if (requestInfo.stakeholder_name && !names.has(requestInfo.stakeholder_name)) {
    list.unshift({ name: requestInfo.stakeholder_name, role: "Primary Stakeholder / Business Owner" });
  }
  list.push({ name: "Business Analyst", role: "BRD Author / Requirements Owner" });
  list.push({ name: "IT Team", role: "Technical Feasibility & Implementation" });
  return list;
}

// ─── Sentence capitaliser ─────────────────────────────────────────────────────
function cap(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Conversation text cleaner ────────────────────────────────────────────────
// Strips first-person language, action-item preambles and conversational filler
// before using chat messages as formal business requirement text.
function cleanToRequirement(raw) {
  let text = String(raw)
    // Remove action-item / confirmation openers
    .replace(/^(next step[s]?[:\s,]*|understood[.\s,]*|noted[.\s,]*|agreed[.\s,]*|sure[,\s]+|ok[ay]*[,.\s]+|thanks?[,.\s]+|do we have[^?]*\??\s*)/i, "")
    // Remove first-person starters like "From my side," "From our end,"
    .replace(/^(from (my|our|the) (side|end|perspective)[,:\s]*)/i, "")
    // Remove first-person pronouns mid-sentence
    .replace(/\b(I've|we've|I'll|we'll|I'm|we're)\b/gi, "the team")
    .replace(/\b(I |me |my |we |us |our )\b/gi, "the organisation ")
    // Remove filler openers
    .replace(/^(also\s+)?(noticing|noticed|noticing that|aware that|seeing that)\s+/i, "There are ")
    .replace(/^(there (is|are|have been)\s+some\s+)/i, "there are ")
    // Strip question text (action items often end in "?")
    .replace(/\?$/, "")
    .replace(/\s+/g, " ")
    .trim();

  // If cleaning ate too much, fall back to raw
  if (text.length < 10) text = raw.trim();

  return cap(text);
}

// ─── Flan-T5 text generation ─────────────────────────────────────────────────
async function generateText(prompt, maxTokens = 120) {
  try {
    const gen = await getGenerator();
    const [result] = await gen(prompt, {
      max_new_tokens: maxTokens,
      num_beams: 4,
      early_stopping: true,
      no_repeat_ngram_size: 3,
    });
    return result.generated_text?.trim() || "";
  } catch (err) {
    console.warn("[BRD Generator] Flan-T5 generation failed:", err.message);
    return "";
  }
}

// ─── Formal requirement rewriter ─────────────────────────────────────────────
async function formaliseRequirement(text) {
  const cleaned = cleanToRequirement(text);
  const lower = cleaned.toLowerCase();

  // Already formal — return as-is
  if (/^the system shall/i.test(lower)) return cap(cleaned);

  const prompt = `Rewrite as a concise formal business system requirement starting with "The system shall". Input: ${cleaned.slice(0, 180)}`;
  const out = await generateText(prompt, 70);
  if (
    out.length > 15 &&
    /^The system shall/i.test(out) &&
    out.length < 300 &&
    // Reject if Flan-T5 just echoed the input
    !out.toLowerCase().startsWith(cleaned.slice(0, 20).toLowerCase())
  ) {
    return cap(out);
  }

  // Smart rule-based fallback — build proper "The system shall" from cleaned text
  const core = cleaned
    .replace(/^(vendor costs have (gone up|increased)|costs have (gone up|increased))/i,
      "track and manage vendor costs that have increased")
    .replace(/^(inefficien(cy|cies) in|some inefficien)/i, "identify and resolve inefficiencies in")
    .replace(/^(there are (some\s+)?)/i, "");

  return `The system shall ${core.charAt(0).toLowerCase() + core.slice(1)}`;
}

// ─── Executive summary generation ────────────────────────────────────────────
async function generateExecutiveSummary(analysis, requestInfo) {
  // Build cleaned requirement snippets — never use raw chat text
  const cleanedReqs = (analysis.key_requirements || [])
    .slice(0, 3)
    .map(cleanToRequirement)
    .filter((r) => r.length > 8);

  const keywords = (analysis.keywords || []).slice(0, 6).join(", ");
  const domain   = requestInfo.category || "General";
  const title    = requestInfo.title || "this initiative";
  const priority = (requestInfo.priority || "Medium").toLowerCase();

  const prompt =
    `Write a 2-sentence professional executive summary for a Business Requirements Document.\n` +
    `Project: "${title}". Domain: ${domain}. Priority: ${priority}.\n` +
    `Key topics: ${keywords || domain}.\n` +
    `Executive Summary:`;

  const out = await generateText(prompt, 120);
  if (out.length > 40 && !out.includes("undefined") && !out.includes(prompt.slice(0, 20))) {
    return out;
  }

  // Fallback: synthesise from metadata — NEVER paste raw chat text
  const focus = cleanedReqs.length
    ? cleanedReqs[0].charAt(0).toLowerCase() + cleanedReqs[0].slice(1)
    : `${domain.toLowerCase()} operational improvements`;

  return (
    `This Business Requirements Document defines the functional and non-functional requirements ` +
    `for the "${cap(title)}" initiative within the ${domain} domain. ` +
    `The project focuses on ${focus}, with ${priority} priority to deliver measurable ` +
    `business outcomes and ${keywords ? `improvements in ${keywords}` : "operational efficiency gains"}.`
  );
}

// ─── Business objective generation ───────────────────────────────────────────
async function generateObjective(analysis, requestInfo) {
  const domain   = requestInfo.category || "General";
  const title    = requestInfo.title || "this initiative";
  const priority = (requestInfo.priority || "Medium").toLowerCase();
  const keywords = (analysis.keywords || []).slice(0, 4).join(", ");

  const prompt =
    `Write a 2-sentence business objective statement.\n` +
    `Project: "${title}". Domain: ${domain}. Priority: ${priority}.\n` +
    `State the business purpose and the expected measurable outcome.\n` +
    `Objective:`;

  const out = await generateText(prompt, 90);
  if (out.length > 30 && !out.includes("undefined") && !out.includes(prompt.slice(0, 20))) {
    return out;
  }

  return (
    `To deliver a comprehensive solution that addresses the identified ${domain.toLowerCase()} ` +
    `business challenges outlined in the "${cap(title)}" initiative, with ${priority} priority focus. ` +
    `This initiative aims to improve ${keywords || domain.toLowerCase() + " efficiency"}, ` +
    `reduce operational costs, and provide measurable business value aligned with organisational goals.`
  );
}

// ─── AI-driven BRD enhancement from stakeholder feedback ─────────────────────
/**
 * Takes an existing BRD and stakeholder improvement comments, runs them through
 * Flan-T5 + pattern logic to produce an improved next-version BRD.
 *
 * @param {object} existingBrd - full BRD JSON (meta + sections)
 * @param {Array<{reviewer_name:string, comment:string}>} improvementComments
 * @param {{id:number, req_number:string, title:string, category:string, priority:string}} requestInfo
 */
export async function enhanceBRD(existingBrd, improvementComments, requestInfo) {
  const commentsText = improvementComments
    .map((c) => `${c.reviewer_name}: ${c.comment}`)
    .join(". ");

  const ex = existingBrd.sections;
  const meta = existingBrd.meta;

  // Bump minor version: "0.1" → "0.2", "1.0" → "1.1"
  const parts = String(meta.version).split(".");
  const newVersion = `${parts[0]}.${parseInt(parts[1] ?? "0") + 1}`;
  const now = new Date();
  const docId = `BRD-${requestInfo.req_number || requestInfo.id}-v${newVersion}`;

  // 1. Regenerate executive summary incorporating feedback
  const execPrompt =
    `Revise this Business Requirements Document executive summary based on stakeholder feedback.\n` +
    `Original: "${ex.executive_summary.text.slice(0, 300)}"\n` +
    `Feedback: "${commentsText.slice(0, 300)}"\n` +
    `Write an improved 2-sentence professional executive summary:`;
  const newExecSummary = await generateText(execPrompt, 120);

  // 2. Extract new requirements from feedback comments (use cleaned originals)
  const existingReqTexts = ex.functional_requirements.items.map(
    (fr) => fr.original || fr.description
  );

  const extractReqPrompt = `From these stakeholder review comments, extract any new system requirements or changes needed: "${commentsText}". List each as a brief requirement. If none, say "none".`;
  const extractedReqs = await generateText(extractReqPrompt, 80);

  const allReqTexts = [...existingReqTexts];
  if (extractedReqs && extractedReqs.length > 10 && !/^none/i.test(extractedReqs)) {
    const newLines = extractedReqs
      .split(/[.;\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && !/^(none|no new|already)/i.test(s));
    allReqTexts.push(...newLines.slice(0, 3));
  }

  // 3. Formalise all requirements (existing + newly extracted)
  const formalRequirements = [];
  for (const [i, req] of allReqTexts.entries()) {
    const formal = await formaliseRequirement(req);
    const isNew = i >= existingReqTexts.length;
    formalRequirements.push({
      id: `FR-${String(i + 1).padStart(3, "0")}`,
      description: formal,
      priority: moscowPriority(req),
      source: isNew
        ? `Stakeholder Feedback (v${newVersion})`
        : ex.functional_requirements.items[i]?.source ?? "Key Conversation (Revised)",
      original: cap(req),
    });
  }

  // 4. Add new risks derived from change-request comments
  const newRisks = [...ex.risk_register.items];
  improvementComments
    .filter((c) => /risk|concern|problem|issue|challenge|gap|miss|fail|wrong|unclear/i.test(c.comment))
    .forEach((c, i) => {
      const isDup = newRisks.some(
        (r) => r.description.toLowerCase().slice(0, 30) === c.comment.toLowerCase().slice(0, 30)
      );
      if (!isDup) {
        const { impact, probability } = assessRisk(c.comment);
        newRisks.push({
          id: `R-${String(ex.risk_register.items.length + i + 1).padStart(3, "0")}`,
          description: cap(c.comment),
          impact,
          probability,
          mitigation: deriveMitigation(c.comment),
        });
      }
    });

  // 5. Re-infer NFRs from the combined text (existing + feedback)
  const allText = [...allReqTexts, commentsText].join(" ");
  const nfrs = inferNFRs(allText).map((nfr, i) => ({
    id: `NFR-${String(i + 1).padStart(3, "0")}`,
    ...nfr,
  }));

  return {
    meta: {
      ...meta,
      doc_id: docId,
      version: newVersion,
      status: "Draft",
      generated_at: now.toISOString(),
      effective_date: now.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      enhanced_from_version: meta.version,
      enhancement_comment_count: improvementComments.length,
      ai_models: meta.ai_models,
    },
    sections: {
      ...ex,
      executive_summary: {
        ...ex.executive_summary,
        text:
          newExecSummary.length > 40 && !newExecSummary.includes("undefined")
            ? newExecSummary
            : `${ex.executive_summary.text} This version incorporates ${improvementComments.length} stakeholder review(s) and addresses raised concerns.`,
      },
      scope: {
        ...ex.scope,
        in_scope: formalRequirements.map((r) => r.original),
      },
      functional_requirements: {
        ...ex.functional_requirements,
        items: formalRequirements,
      },
      non_functional_requirements: {
        ...ex.non_functional_requirements,
        items: nfrs,
      },
      risk_register: {
        ...ex.risk_register,
        items: newRisks,
      },
    },
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateBRD(analysis, requestInfo, messages = []) {
  const now = new Date();
  const versionNum = "0.1";
  const docId = `BRD-${requestInfo.req_number || requestInfo.id || "DRAFT"}-v${versionNum}`;

  // ── Parallel AI tasks ──────────────────────────────────────────────────────
  const allReqText = [...(analysis.key_requirements || []), ...(analysis.action_items || [])].join(" ");
  const allConcernText = (analysis.stakeholder_concerns || []).join(" ");
  const allText = `${allReqText} ${allConcernText}`;

  const [execSummary, objective] = await Promise.all([
    generateExecutiveSummary(analysis, requestInfo),
    generateObjective(analysis, requestInfo),
  ]);

  // Formalise requirements (run sequentially to avoid memory spikes)
  const formalRequirements = [];
  for (const [i, req] of (analysis.key_requirements || []).entries()) {
    const formal = await formaliseRequirement(req);
    formalRequirements.push({
      id: `FR-${String(i + 1).padStart(3, "0")}`,
      description: formal,
      priority: moscowPriority(req),
      source: "Key Conversation",
      original: cap(req),
    });
  }

  // ── NFRs ──────────────────────────────────────────────────────────────────
  const nfrs = inferNFRs(allText).map((nfr, i) => ({
    id: `NFR-${String(i + 1).padStart(3, "0")}`,
    ...nfr,
  }));

  // ── Risk register ─────────────────────────────────────────────────────────
  const risks = (analysis.stakeholder_concerns || []).map((concern, i) => {
    const { impact, probability } = assessRisk(concern);
    return {
      id: `R-${String(i + 1).padStart(3, "0")}`,
      description: cap(concern),
      impact,
      probability,
      mitigation: deriveMitigation(concern),
    };
  });

  // ── Scope ─────────────────────────────────────────────────────────────────
  const inScope  = formalRequirements.map((r) => r.original);
  const outOfScope = extractOutOfScope(analysis.key_requirements || [], analysis.stakeholder_concerns || []);

  // ── Stakeholders ──────────────────────────────────────────────────────────
  const stakeholders = extractStakeholders(messages, requestInfo);

  // ── Action items ──────────────────────────────────────────────────────────
  const actionItems = (analysis.action_items || []).map((item, i) => ({
    id: `A-${String(i + 1).padStart(3, "0")}`,
    description: cap(item),
    status: "Open",
  }));

  // ── Goals (cleaned from requirements — no raw chat text) ─────────────────
  const goals = analysis.key_requirements
    .slice(0, 4)
    .map((r) => cleanToRequirement(r).replace(/^(the system shall|must|should|need to)\s*/i, ""))
    .map(cap);

  // ── Assemble BRD ──────────────────────────────────────────────────────────
  return {
    meta: {
      doc_id: docId,
      version: versionNum,
      status: "Draft",
      request_id: requestInfo.id,
      request_number: requestInfo.req_number,
      title: requestInfo.title,
      category: requestInfo.category || "General",
      priority: requestInfo.priority || "Medium",
      generated_at: now.toISOString(),
      effective_date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      ai_models: ["Xenova/nli-deberta-v3-small (zero-shot classification)", "Xenova/flan-t5-base (text generation)"],
      source_messages: analysis.message_count,
    },
    sections: {
      executive_summary: {
        number: "1",
        title: "Executive Summary",
        text: execSummary,
      },
      objective: {
        number: "2",
        title: "Business Objective & Goals",
        text: objective,
        goals,
      },
      scope: {
        number: "3",
        title: "Scope",
        in_scope: inScope,
        out_of_scope: outOfScope,
      },
      stakeholders: {
        number: "4",
        title: "Stakeholder Analysis",
        list: stakeholders,
      },
      functional_requirements: {
        number: "5",
        title: "Functional Requirements",
        items: formalRequirements,
      },
      non_functional_requirements: {
        number: "6",
        title: "Non-Functional Requirements",
        items: nfrs,
      },
      risk_register: {
        number: "7",
        title: "Risk Register",
        items: risks,
      },
      action_items: {
        number: "8",
        title: "Action Items & Next Steps",
        items: actionItems,
      },
      brd_readiness: {
        number: "9",
        title: "BRD Readiness Assessment",
        ...analysis.brd_readiness,
      },
      appendix: {
        title: "Appendix A: Key Conversation Excerpts",
        messages: messages.map((m) => ({
          sender: m.sender_name,
          text: m.message_text,
          marked_at: m.marked_at,
        })),
        keywords: analysis.keywords,
      },
    },
  };
}
