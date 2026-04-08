/**
 * BRD Agent — Neural AI analysis engine using Transformers.js.
 *
 * Uses a real transformer neural network (DeBERTa-v3) for zero-shot classification,
 * augmented with domain-specific pattern extraction so financial/banking/API
 * requirements are never missed even if the neural model misclassifies them.
 *
 * Pipeline:
 *  1. Domain pattern extraction  — financial, API, compliance, integration keywords
 *  2. Zero-shot classification   — DeBERTa-v3-small for each message
 *  3. TF-IDF keyword extraction  — fast, domain-accurate
 *  4. BRD readiness assessment   — deterministic domain checks
 *  5. Executive summary          — synthesised from top-scored messages
 */

import { pipeline, env } from "@xenova/transformers";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
env.cacheDir = join(__dirname, "../../models");
env.allowLocalModels = true;

const MODEL_ID = "Xenova/nli-deberta-v3-small";

const CANDIDATE_LABELS = [
  "business requirement or functional need",
  "risk, concern, or problem",
  "action item or next step",
  "general discussion",
];

// Singleton model loader
let _classifier = null;
let _loadPromise = null;

async function getClassifier() {
  if (_classifier) return _classifier;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    console.log("[BRD Agent] Loading neural model (first run ~30s)…");
    _classifier = await pipeline("zero-shot-classification", MODEL_ID, { quantized: true });
    console.log("[BRD Agent] Neural model ready.");
    return _classifier;
  })();
  return _loadPromise;
}

// ─── Stopwords ────────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","it","its","as","be","was","are","were","been","has",
  "have","had","do","does","did","not","no","so","if","this","that","these",
  "those","my","your","his","her","our","their","we","i","you","he","she",
  "they","me","him","us","them","what","which","who","how","when","where",
  "why","will","would","could","should","may","might","can","just","also",
  "more","some","any","all","very","too","even","about","up","out","then",
  "than","there","into","only","like","over","after","before","again","get",
  "got","make","made","going","go","well","still","know","think","see","say",
  "said","im","ive","id","dont","doesnt","isnt","wasnt","thats","its",
]);

// ─── General BRD domain patterns ─────────────────────────────────────────────
const REQUIREMENT_RE = [
  /\b(need|needs|needed)\b/i,
  /\b(require[sd]?|requirement[s]?)\b/i,
  /\b(must|should|shall)\b/i,
  /\b(want[s]?|wanted)\b/i,
  /\b(expect[s]?|expected|expectation[s]?)\b/i,
  /\b(necessary|essential|critical|mandatory)\b/i,
  /\b(has to|have to|need to)\b/i,
  /\b(feature[s]?|functionality|capability|capabilities)\b/i,
  /\b(allow[s]?|enable[s]?|support[s]?|provide[s]?)\b/i,
];
const CONCERN_RE = [
  /\b(issue[s]?|problem[s]?)\b/i,
  /\b(concern[s]?|concerned)\b/i,
  /\b(risk[s]?|risky)\b/i,
  /\b(challenge[s]?|difficult[y]?)\b/i,
  /\b(block[s]?|blocker[s]?|blocked)\b/i,
  /\b(worr(y|ied|ies)|worried)\b/i,
  /\b(unclear|uncertain|unsure|ambiguous)\b/i,
  /\b(delay[s]?|delayed|late)\b/i,
  /\b(fail[s]?|failure|error[s]?|bug[s]?)\b/i,
];
const TIMELINE_RE  = /\b(week[s]?|month[s]?|day[s]?|deadline[s]?|due|sprint[s]?|quarter|asap|urgent|soon|by \w+day|q[1-4])\b/i;
const STAKEHOLDER_RE = /\b(user[s]?|stakeholder[s]?|team[s]?|client[s]?|customer[s]?|manager|director|owner[s]?|department)\b/i;
const SUCCESS_RE   = /\b(success|successf[a-z]+|goal[s]?|objective[s]?|outcome[s]?|kpi[s]?|metric[s]?|measur[a-z]+|achiev[a-z]+)\b/i;

// ─── Domain-specific requirement extractors ───────────────────────────────────
// These catch specialised requirements that generic NLI models may misclassify.

const DOMAIN_PATTERNS = [
  // Financial / banking
  { re: /\b(upload|pdf|statement|bank statement|document upload|attach)\b/i,         domain: "upload" },
  { re: /\b(salary|income|credit|transaction|parse|extract|emi|obligation|bounce|cheque bounce)\b/i, domain: "financial_data" },
  { re: /\b(average|calculate|computation|6 month|six month|income assessment)\b/i,   domain: "calculation" },
  { re: /\b(fraud|suspicious|cash deposit|irregular|pattern|anomal|detect)\b/i,       domain: "fraud_detection" },
  { re: /\b(consent|gdpr|permission|authoris|privacy|approval before|customer consent)\b/i, domain: "compliance" },
  { re: /\b(manual review|manual underwr|route|fallback|not detected|escalat)\b/i,   domain: "fallback_flow" },
  // API / integration
  { re: /\b(api|rest|endpoint|webhook|third.?party|integration|account aggregator|aggregator|vendor|service|response time|latency)\b/i, domain: "integration" },
  { re: /\b(json|xml|payload|format|output|input|pdf|net banking|fetch)\b/i,          domain: "data_format" },
  { re: /\b(encrypt|secure|api key|authentication|token|tls|https|ssl)\b/i,           domain: "security" },
  { re: /\b(store|storage|retain|persist|save only|summary only|not store|derived)\b/i, domain: "storage" },
  { re: /\b(performance|response time|latency|8.10 second|within \d+ second|sla|timeout)\b/i, domain: "performance" },
];

/**
 * For each message, annotate which domain signals it carries.
 * Returns a set of domain strings present in the message.
 */
function detectDomains(text) {
  const found = new Set();
  DOMAIN_PATTERNS.forEach(({ re, domain }) => {
    if (re.test(text)) found.add(domain);
  });
  return found;
}

/**
 * Force-classify messages that match strong domain patterns as requirements,
 * even if the neural model disagrees. This ensures financial/API messages
 * are never silently dropped into the "general" bucket.
 */
const FORCE_REQUIREMENT_DOMAINS = new Set([
  "upload", "financial_data", "calculation", "fraud_detection",
  "compliance", "fallback_flow", "integration", "security", "storage", "performance",
]);

// ─── TF-IDF ───────────────────────────────────────────────────────────────────
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function computeTfIdf(docs) {
  const N = docs.length;
  if (N === 0) return {};
  const tfDocs = docs.map((d) => {
    const tokens = tokenize(d);
    const tf = {};
    tokens.forEach((t) => { tf[t] = (tf[t] || 0) + 1; });
    const max = Math.max(...Object.values(tf), 1);
    Object.keys(tf).forEach((t) => { tf[t] /= max; });
    return tf;
  });
  const df = {};
  tfDocs.forEach((tf) => Object.keys(tf).forEach((t) => { df[t] = (df[t] || 0) + 1; }));
  const scores = {};
  tfDocs.forEach((tf) => {
    Object.entries(tf).forEach(([t, freq]) => {
      scores[t] = (scores[t] || 0) + freq * (Math.log((N + 1) / (df[t] + 1)) + 1);
    });
  });
  return scores;
}

function topKeywords(tfidf, n = 12) {
  return Object.entries(tfidf).sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

function deduplicate(sentences) {
  const kept = [];
  for (const s of sentences) {
    const tokens = new Set(tokenize(s));
    const isDup = kept.some((k) => {
      const kTokens = new Set(tokenize(k));
      const intersection = [...tokens].filter((t) => kTokens.has(t)).length;
      const union = new Set([...tokens, ...kTokens]).size;
      return union > 0 && intersection / union > 0.65;
    });
    if (!isDup) kept.push(s);
  }
  return kept;
}

function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }

// ─── BRD Readiness ────────────────────────────────────────────────────────────
function brdReadiness(messages) {
  const allText = messages.map((m) => m.message_text).join(" ");
  const checks = [
    { label: "Requirements defined",     pass: REQUIREMENT_RE.some((r) => r.test(allText)) },
    { label: "Stakeholders identified",  pass: STAKEHOLDER_RE.test(allText) },
    { label: "Timelines mentioned",      pass: TIMELINE_RE.test(allText) },
    { label: "Success criteria present", pass: SUCCESS_RE.test(allText) },
    { label: "Risks / concerns raised",  pass: CONCERN_RE.some((r) => r.test(allText)) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const readinessLevel = score >= 5 ? "High — ready to start BRD draft"
    : score >= 3 ? "Medium — a few gaps remain"
    : "Low — more discussion needed";
  return { checks, score, readinessLevel };
}

// ─── Executive summary ────────────────────────────────────────────────────────
function buildExecutiveSummary(categorised, requestInfo) {
  const parts = [];
  if (categorised.requirements.length) parts.push(cap(categorised.requirements[0].text));
  if (categorised.concerns.length)     parts.push(`Key concern: ${categorised.concerns[0].text.toLowerCase()}`);
  if (categorised.actions.length)      parts.push(`Next step: ${categorised.actions[0].text.toLowerCase()}`);
  if (!parts.length) {
    return `Discussion for "${requestInfo.title}" covers the core business need. Review the marked messages for detailed context.`;
  }
  return parts.join(" ");
}

// ─── Integration signal extraction ───────────────────────────────────────────
/**
 * Scans ALL messages for integration/API/compliance signals and returns
 * structured metadata the BRD generator can use to add dedicated sections.
 */
function extractIntegrationSignals(messages) {
  const signals = {
    has_api_integration: false,
    api_response_time:   null,
    input_formats:       new Set(),
    output_formats:      new Set(),
    vendors:             new Set(),
    auth_type:           null,
  };

  messages.forEach(({ message_text }) => {
    const t = message_text.toLowerCase();

    if (/\bapi\b|rest\b|endpoint|integration|aggregator|third.?party/.test(t)) signals.has_api_integration = true;
    if (/pdf/.test(t))  signals.input_formats.add("PDF");
    if (/json/.test(t)) signals.output_formats.add("JSON");
    if (/xml/.test(t))  signals.output_formats.add("XML");
    if (/net banking/.test(t)) signals.input_formats.add("Net Banking Fetch");

    const vendorMatch = t.match(/account aggregator|statement pars|third.?party\s+\w+|[\w\s]+api/);
    if (vendorMatch) signals.vendors.add(cap(vendorMatch[0].trim()));

    const timeMatch = message_text.match(/(\d+)[–\-–](\d+)\s*second/i) || message_text.match(/within\s+(\d+)\s*second/i);
    if (timeMatch) signals.api_response_time = timeMatch[0];

    if (/api key|api.key|bearer|oauth|jwt/.test(t)) signals.auth_type = "Secure API Key / Bearer Token";
  });

  return {
    has_api_integration: signals.has_api_integration,
    api_response_time:   signals.api_response_time,
    input_formats:       [...signals.input_formats],
    output_formats:      [...signals.output_formats],
    vendors:             [...signals.vendors].filter(Boolean),
    auth_type:           signals.auth_type,
  };
}

/**
 * Extracts compliance-specific signals from messages.
 */
function extractComplianceSignals(messages) {
  return {
    consent_required:   messages.some(({ message_text: t }) => /consent|permission|authoris|approval before/i.test(t)),
    data_privacy:       messages.some(({ message_text: t }) => /gdpr|privacy|sensitive|encrypt|personal data/i.test(t)),
    storage_restricted: messages.some(({ message_text: t }) => /store.*summary|not.*full|only.*derived|summary only/i.test(t)),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function analyseKeyPoints(messages, requestInfo) {
  if (!messages || messages.length === 0) {
    return { error: "No key points to analyse. Please mark at least one message first." };
  }

  // ── 1. Domain signal annotation on every message ──────────────────────────
  const annotated = messages.map((m) => ({
    ...m,
    domains: detectDomains(m.message_text),
  }));

  // ── 2. TF-IDF keywords ────────────────────────────────────────────────────
  const tfidf    = computeTfIdf(messages.map((m) => m.message_text));
  const keywords = topKeywords(tfidf, 12);

  // ── 3. Neural zero-shot classification ───────────────────────────────────
  let categorised = { requirements: [], concerns: [], actions: [], general: [] };

  try {
    const classifier = await getClassifier();
    const results = await Promise.all(
      messages.map((m) => classifier(m.message_text, CANDIDATE_LABELS, { multi_label: false }))
    );

    results.forEach((result, i) => {
      const msg       = annotated[i];
      const topLabel  = result.labels[0];
      const confidence = result.scores[0];
      const entry     = { text: msg.message_text, sender: msg.sender_name, confidence, domains: msg.domains };

      // Force requirement classification for domain-specific messages
      const hasForcedDomain = [...msg.domains].some((d) => FORCE_REQUIREMENT_DOMAINS.has(d));

      if (hasForcedDomain || topLabel.includes("requirement") || topLabel.includes("functional")) {
        categorised.requirements.push(entry);
      } else if (topLabel.includes("risk") || topLabel.includes("concern") || topLabel.includes("problem")) {
        categorised.concerns.push(entry);
      } else if (topLabel.includes("action") || topLabel.includes("next step")) {
        categorised.actions.push(entry);
      } else {
        categorised.general.push(entry);
      }
    });

    for (const key of Object.keys(categorised)) {
      categorised[key].sort((a, b) => b.confidence - a.confidence);
    }

    console.log(`[BRD Agent] Classified ${messages.length} messages (neural + domain override).`);
  } catch (err) {
    console.warn("[BRD Agent] Neural classification failed, using pattern fallback:", err.message);
    annotated.forEach((m) => {
      const entry = { text: m.message_text, sender: m.sender_name, confidence: 0.5, domains: m.domains };
      const hasForcedDomain = [...m.domains].some((d) => FORCE_REQUIREMENT_DOMAINS.has(d));
      const isReq = hasForcedDomain || REQUIREMENT_RE.some((r) => r.test(m.message_text));
      const isCon = CONCERN_RE.some((r) => r.test(m.message_text));
      if (isReq) categorised.requirements.push(entry);
      else if (isCon) categorised.concerns.push(entry);
      else categorised.actions.push(entry);
    });
  }

  // ── 4. Deduplicate & pick top (cap raised to 12 for complex multi-party chats)
  const pickTop = (items, n) =>
    deduplicate(items.map((i) => i.text)).slice(0, n).map((t) => cap(t.trim()));

  const requirements = pickTop(categorised.requirements, 12);
  const concerns     = pickTop(categorised.concerns, 6);
  const actions      = pickTop(categorised.actions, 6);

  // ── 5. Structured signal extraction ──────────────────────────────────────
  const integration_signals = extractIntegrationSignals(messages);
  const compliance_signals  = extractComplianceSignals(messages);

  // ── 6. BRD Readiness ─────────────────────────────────────────────────────
  const readiness = brdReadiness(messages);

  // ── 7. Executive summary ──────────────────────────────────────────────────
  const summary = buildExecutiveSummary(
    { requirements: categorised.requirements, concerns: categorised.concerns, actions: categorised.actions },
    requestInfo
  );

  return {
    generated_at:        new Date().toISOString(),
    ai_model:            MODEL_ID,
    request:             { title: requestInfo.title, category: requestInfo.category, priority: requestInfo.priority, status: requestInfo.status },
    executive_summary:   summary,
    key_requirements:    requirements.length ? requirements : pickTop([...categorised.general, ...categorised.requirements], 4),
    stakeholder_concerns: concerns,
    action_items:        actions,
    keywords,
    integration_signals,
    compliance_signals,
    brd_readiness:       readiness,
    message_count:       messages.length,
  };
}
