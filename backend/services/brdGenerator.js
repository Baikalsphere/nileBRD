/**
 * BRD Generator — Advanced AI document generation engine.
 *
 * Pipeline:
 *  1. Functional area grouping   — requirements clustered into 8 domain areas
 *  2. Professional requirement synthesis — comprehensive "shall" statements per area
 *  3. Scope narrative builder    — intelligent summary, NOT copy-paste of chat
 *  4. Process flow derivation    — end-to-end business process steps
 *  5. Executive summary          — 4-element professional narrative
 *  6. SMART objectives           — goal statements tied to domain signals
 *  7. NFR inference              — 10-category expanded coverage
 *  8. Business rules extraction  — domain pattern matching
 *  9. Integration requirements   — from agent signals + domain patterns
 * 10. Risk matrix                — impact / probability / mitigation
 * 11. Full JSON BRD assembly     — numbered sections, IDs, version metadata
 */

import OpenAI from "openai";

const GEN_MODEL = `azure/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`;

// Azure OpenAI client (shared singleton)
const azureClient = new OpenAI({
  apiKey:         process.env.AZURE_OPENAI_API_KEY,
  baseURL:        `${(process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "")}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"}`,
  defaultQuery:   { "api-version": process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});

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

// ─── NFR inference ─────────────────────────────────────────────────────────────
const NFR_PATTERNS = [
  { re: /\b(fast|quick|speed|response time|latency|performance|throughput|efficient|\d+\s*second[s]?|within \d+)\b/i,
    category: "Performance",
    desc: "System response times shall meet agreed SLA targets. API calls shall complete within the specified time window. UI interactions shall respond within 2 seconds under normal load." },
  { re: /\b(secure|security|authentication|authoris|encrypt|access control|permission|role|api key|tls|https)\b/i,
    category: "Security",
    desc: "All data access shall require authentication. Sensitive financial and personal data shall be encrypted in transit (TLS 1.2+) and at rest. Role-based access controls shall restrict functionality to authorised users only." },
  { re: /\b(uptime|availability|24.7|always on|reliable|disaster|failover|backup)\b/i,
    category: "Availability",
    desc: "System availability shall meet a minimum 99.5% uptime SLA during agreed business hours. Planned maintenance shall be scheduled outside core hours with prior notification." },
  { re: /\b(scale|scalab|load|concurrent|users|traffic|grow)\b/i,
    category: "Scalability",
    desc: "The system shall scale horizontally to support a 3× increase in concurrent users without degradation in response times or data integrity." },
  { re: /\b(audit|log|track|monitor|compliance|regulatory|gdpr|legal)\b/i,
    category: "Compliance & Audit",
    desc: "All state-changing operations and data access events shall be logged in an immutable audit trail. Logs shall be retained per the organisation's data governance policy and made available to authorised compliance personnel on request." },
  { re: /\b(consent|customer consent|permission|authoris|approval before|mandatory consent)\b/i,
    category: "Regulatory Compliance & Consent",
    desc: "Explicit, informed customer consent shall be obtained and recorded before any personal or financial data is fetched, processed, or shared. Consent records shall be stored with timestamp and session attribution for regulatory audit." },
  { re: /\b(store only|summary only|not store|derived|store.*summary|sensitive.*not.*store|no.*full.*statement)\b/i,
    category: "Data Storage & Privacy",
    desc: "Only derived financial summary values shall be persisted after processing. Raw bank statements and full transaction data shall not be stored beyond the immediate processing session. Storage minimisation is required to meet data protection obligations." },
  { re: /\b(mobile|responsive|device|tablet|phone|browser|cross.platform)\b/i,
    category: "Usability",
    desc: "The user interface shall be fully responsive and accessible across modern desktop and mobile browsers. WCAG 2.1 AA accessibility standards shall be observed." },
  { re: /\b(integrat|api|third.?party|connect|sync|interface|webhook|aggregator)\b/i,
    category: "Interoperability",
    desc: "The system shall expose documented REST APIs and conform to agreed integration contracts with third-party vendors. API versioning shall be maintained to avoid breaking changes." },
  { re: /\b(maintain|support|update|patch|upgr|version)\b/i,
    category: "Maintainability",
    desc: "The system shall be architectured in modular, independently deployable components. Code coverage shall be maintained at ≥80% to enable safe change and refactoring." },
];

function inferNFRs(allText, complianceSignals = {}) {
  const seen = new Set();
  const nfrs = [];
  NFR_PATTERNS.forEach(({ re, category, desc }) => {
    let matches = re.test(allText);
    if (category === "Regulatory Compliance & Consent" && complianceSignals.consent_required) matches = true;
    if (category === "Data Storage & Privacy"          && complianceSignals.storage_restricted) matches = true;
    if (matches && !seen.has(category)) {
      seen.add(category);
      nfrs.push({ category, description: desc });
    }
  });
  return nfrs;
}

// ─── Business rules extraction ────────────────────────────────────────────────
const BUSINESS_RULE_PATTERNS = [
  { re: /6 month|six month|last 6|minimum.*month|month.*minimum/i,
    rule: "A minimum of 6 months of bank statement history is required for income assessment. Submissions with fewer than 6 months of data shall be flagged for manual review." },
  { re: /salary.*narration|narration.*salary|narration format|identify.*salary|salary.*identif/i,
    rule: "Salary credit narration patterns shall be matched against a configurable library of bank-specific narration formats to correctly identify salary transactions across all supported institutions." },
  { re: /average.*income|income.*average|average.*salary|average.*credit/i,
    rule: "Average monthly income shall be computed from identified salary credits over the most recent 6-month period. Months with no salary credit shall be treated as zero and included in the average calculation." },
  { re: /not detected|salary not|no salary|manual review|manual underwr/i,
    rule: "Applications where automated salary identification yields no result shall be automatically routed to the manual underwriting queue. The routing decision shall be logged with the triggering reason." },
  { re: /irregular|inconsistent|sudden drop|drop in salary|irregular pattern/i,
    rule: "Irregular income patterns — including salary drops exceeding 30% month-on-month or more than 2 months of absent credit — shall be flagged as a risk indicator and attached to the case record." },
  { re: /bounced|bounce|cheque bounce|neft bounce/i,
    rule: "Cheque and NEFT return (bounce) events shall be counted over the statement period and used as a negative credit signal. Cases exceeding the defined bounce threshold shall be escalated to risk review." },
  { re: /emi|obligation|loan obligation|existing loan/i,
    rule: "Existing EMI obligations identified in the transaction data shall be aggregated and deducted from gross income to derive the net available income for eligibility assessment." },
  { re: /cash deposit|high.*cash|suspicious.*cash|large.*deposit/i,
    rule: "High-value cash deposits occurring within 90 days of loan application shall be automatically flagged for fraud review. The flagging threshold shall be configurable by the risk team." },
  { re: /consent|customer consent|permission.*fetch|fetch.*permission/i,
    rule: "Customer explicit consent must be captured and stored before any bank statement data is fetched or processed. Processing initiated without a valid consent record is prohibited." },
  { re: /store.*summary|summary.*store|not.*full.*statement|only.*derived/i,
    rule: "Only derived summary values (income average, EMI total, bounce count, risk flags) shall be stored post-processing. Raw statement data and full transaction records must not be persisted beyond the active processing session." },
  { re: /api.*response|response.*time|8.*second|10.*second|\d+.*second.*api/i,
    rule: "Third-party API integrations shall complete within the agreed response time SLA. Calls exceeding the timeout threshold shall trigger a configurable fallback response and generate an operational alert." },
  { re: /pdf.*initially|initially.*pdf|support.*pdf|pdf.*support/i,
    rule: "PDF is the supported bank statement format for Phase 1. Net banking fetch and direct aggregator access are deferred to Phase 2 and must not be included in the Phase 1 delivery scope." },
];

function extractBusinessRules(allText) {
  const seen = new Set();
  const rules = [];
  BUSINESS_RULE_PATTERNS.forEach(({ re, rule }) => {
    if (re.test(allText) && !seen.has(rule)) { seen.add(rule); rules.push(rule); }
  });
  if (!rules.some((r) => /audit/i.test(r)))
    rules.push("All state-changing operations shall be recorded in an immutable audit log capturing actor identity, action, affected entity, input parameters, and outcome timestamp.");
  if (!rules.some((r) => /validation/i.test(r)))
    rules.push("All business logic and data validation shall be enforced server-side. Client-side validation is supplementary and must not be relied upon as the sole control.");
  return rules;
}

// ─── Integration requirements builder ────────────────────────────────────────
function buildIntegrationRequirements(integrationSignals = {}) {
  const items = [];
  if (!integrationSignals || !integrationSignals.has_api_integration) return items;

  const { input_formats = [], output_formats = [], vendors = [], auth_type, api_response_time } = integrationSignals;

  items.push({
    id:          "INT-001",
    type:        "REST API",
    system:      vendors.length ? vendors[0] : "Third-Party Bank Statement Parsing API",
    direction:   "Outbound",
    input:       input_formats.join(" / ") || "PDF Bank Statement",
    output:      output_formats.join(" / ") || "JSON — structured transaction data",
    auth:        auth_type || "Secure API Key",
    sla:         api_response_time ? `Response within ${api_response_time}` : "Response within agreed SLA (recommended ≤10 s)",
    description: `Outbound REST integration with ${vendors.length ? vendors[0] : "a certified third-party statement parsing API"} to extract structured transaction data from submitted bank statement documents. The API shall return a categorised JSON payload including salary credits, EMI transactions, bounce events, and summary balances.`,
  });

  if (vendors.length > 1) {
    items.push({
      id:          "INT-002",
      type:        "REST API",
      system:      vendors[1],
      direction:   "Outbound",
      input:       input_formats.join(" / ") || "PDF Bank Statement",
      output:      output_formats.join(" / ") || "JSON Structured Data",
      auth:        auth_type || "Secure API Key",
      sla:         api_response_time ? `Response within ${api_response_time}` : "Response within agreed SLA",
      description: `Fallback integration with ${vendors[1]} as an alternate statement parsing provider in the event the primary vendor is unavailable or returns an error response.`,
    });
  }

  if (input_formats.includes("PDF")) {
    items.push({
      id:          `INT-00${items.length + 1}`,
      type:        "File Upload",
      system:      "Document Upload & Temporary Storage Service",
      direction:   "Inbound",
      input:       "PDF document (maximum file size per policy)",
      output:      "Document reference ID + parsed transaction JSON",
      auth:        "JWT Bearer Token (authenticated customer session)",
      sla:         "Upload acknowledgement < 5 s; processing completion < 30 s",
      description: "Customer-facing inbound file upload endpoint that accepts PDF bank statements, validates file type and size, stores the document temporarily during processing, and discards the raw file after data extraction is complete.",
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
  const impact      = HIGH_IMPACT_RE.test(text) ? "High"   : LOW_IMPACT_RE.test(text) ? "Low"  : "Medium";
  const probability = HIGH_PROB_RE.test(text)   ? "High"   : LOW_PROB_RE.test(text)   ? "Low"  : "Medium";
  return { impact, probability };
}

const MITIGATION_MAP = {
  performance:  "Conduct early load and performance testing. Define SLA benchmarks before development begins. Implement response caching and asynchronous processing for long-running operations.",
  security:     "Engage the security team for threat modelling in the design phase. Implement OWASP Top 10 mitigations. Conduct penetration testing before go-live. Encrypt all PII and financial data at rest and in transit.",
  integration:  "Prototype the integration in a discovery spike. Agree API contracts, error handling, and SLA commitments with the vendor before implementation. Define and test fallback behaviour.",
  data:         "Define a data governance policy covering classification, retention, and access. Implement field-level encryption for financial and personal data. Validate data lineage and accuracy in UAT.",
  timeline:     "Break delivery into defined milestones with documented acceptance criteria. Surface blockers in weekly status reviews. Escalate to the project sponsor if critical path items are at risk.",
  requirement:  "Schedule targeted requirement workshops to resolve ambiguities. Document decisions and obtain stakeholder sign-off before development commences.",
  stakeholder:  "Establish a regular stakeholder review cadence (minimum bi-weekly). Document and circulate meeting minutes. Ensure key decisions are formally approved.",
  resource:     "Identify resource gaps at the planning stage. Agree contingency cover for critical roles. Escalate to the project sponsor immediately if gaps cannot be resolved internally.",
  technical:    "Spike technical unknowns in early sprints to de-risk the delivery. Document architecture decisions using ADRs. Ensure senior technical review of all design choices.",
  compliance:   "Engage the legal and compliance team to review the consent framework, data retention policy, and regulatory obligations before implementation begins.",
  fraud:        "Define fraud detection thresholds and rules collaboratively with the risk team. Include fraud scenario coverage in UAT. Plan a post-launch monitoring and tuning phase.",
  manual:       "Design the manual review queue UX in collaboration with the operations team. Define and agree a service level for manual case resolution. Include manual workflow in UAT scope.",
};

function deriveMitigation(text) {
  const lower = text.toLowerCase();
  for (const [keyword, mitigation] of Object.entries(MITIGATION_MAP)) {
    if (lower.includes(keyword)) return mitigation;
  }
  return "Assign a named risk owner. Review risk status at each sprint review and milestone gate. Escalate immediately if the risk materialises or the likelihood increases.";
}

// ─── Professional risk description formaliser ────────────────────────────────
/**
 * Converts raw stakeholder concern text (informal chat) into a professional
 * risk register entry description.  Matches domain signals first; falls back
 * to a cleaned generic statement.
 */
const RISK_DOMAIN_TEMPLATES = [
  { re: /vendor|third.?party|provider|aggregator|account aggregator/i,
    desc: "The project relies on a third-party vendor or external service provider for a core processing capability. Vendor non-availability, unilateral API contract changes, or SLA non-compliance could delay the delivery timeline or cause production-level incidents. The absence of a contracted fallback provider amplifies this exposure." },
  { re: /performance|latency|response time|timeout|8 second|10 second|speed|slow/i,
    desc: "Third-party API response times may fail to consistently meet the agreed SLA under real-world production load. If the parsing or integration API repeatedly exceeds the defined timeout threshold, downstream assessment workflows will be blocked, directly degrading customer experience and operational throughput. No SLA breach remedy mechanism is currently defined." },
  { re: /salary.*not|not.*detect|identify.*salary|manual.*review|manual review|fallback|not detected/i,
    desc: "The automated income assessment engine may fail to identify salary credits for a subset of bank account formats or non-standard transaction narration patterns. Such cases will require manual underwriting review, creating an operational burden, introducing processing delays, and risking inconsistent decision-making if the manual review queue is not adequately resourced." },
  { re: /fraud|suspicious|cash deposit|irregular|anomal/i,
    desc: "The fraud detection ruleset may not adequately cover all novel or emerging fraud patterns present in submitted bank statements. False negatives — where fraudulent applications are not flagged — expose the organisation to direct financial loss. Excessive false positives conversely increase the manual review workload and delay legitimate applications." },
  { re: /consent|permission|regulatory|gdpr|compliance|legal/i,
    desc: "Failure to implement the customer consent framework in full compliance with applicable data protection regulations exposes the organisation to regulatory enforcement action, significant financial penalties, and reputational damage. The consent wording, storage mechanism, and revocation process must be reviewed and formally approved by the legal and compliance team before implementation." },
  { re: /data|privacy|store|storage|sensitive|bank statement|retain/i,
    desc: "Unintended retention of raw bank statement files or full transaction records beyond the processing session would constitute a data minimisation breach, creating regulatory liability and increasing the organisation's exposure in the event of a data security incident. Strict post-processing purge controls must be implemented, tested, and verified at every release." },
  { re: /unclear|ambiguous|undefined|not defined|not specified|missing.*requirement|scope.*unclear/i,
    desc: "One or more requirements lack sufficient detail or contain ambiguities that could lead to incorrect system behaviour, scope creep, or costly rework during development or UAT. Unresolved ambiguities at the commencement of development significantly increase the risk of delivery delays and stakeholder dissatisfaction with the delivered solution." },
  { re: /timeline|deadline|schedule|delay|capacity|resource|late|sprint/i,
    desc: "The current delivery timeline is at risk due to open dependencies, resource constraints, or the volume of unresolved requirement items. A slippage on any critical path dependency will cascade across all downstream milestones, including UAT, integration testing, and the planned go-live date." },
  { re: /cost|budget|expensive|price|fee|licen/i,
    desc: "Vendor API licensing or operational costs may escalate beyond the agreed budget envelope, particularly where usage-based pricing applies and processing volumes exceed original estimates. Budget overruns could necessitate scope reduction, delivery phasing, or escalation to the project sponsor for additional funding approval." },
  { re: /security|encrypt|access|unauthoris|credential|breach|token|authentication/i,
    desc: "Insufficient access controls, weak credential management practices, or inadequate encryption of financial and personal data could result in unauthorised data access or a security breach. Financial data represents a high-value target, and any control deficiency in this system carries significant legal, regulatory, and reputational consequences." },
  { re: /integration|connect|api|endpoint|webhook|interface/i,
    desc: "Integration with external services introduces interface stability risk. Breaking changes to external API contracts, authentication scheme changes, or infrastructure connectivity issues in the production environment could render core system capabilities unavailable without prior warning or agreed remediation timelines." },
  { re: /adoption|training|user.*accept|change.*management|resistance/i,
    desc: "End users and operational teams may resist adopting the new system or may require more training than planned to operate it effectively. Low adoption rates reduce the realised business value of the investment and may result in continued dependence on manual processes the system was designed to replace." },
];

function formaliseRisk(rawText) {
  for (const { re, desc } of RISK_DOMAIN_TEMPLATES) {
    if (re.test(rawText)) return desc;
  }
  // Fallback: clean the raw text and wrap in a professional risk statement
  const cleaned = cleanToRequirement(rawText)
    .replace(/^the system shall /i, "")
    .replace(/^(the (organisation|team) (should|must|needs? to) )/i, "");
  const lower = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  return `There is an identified operational risk that ${lower}. ` +
    "This risk requires a named owner, a formal mitigation plan, and scheduled review at each project milestone gate.";
}

// ─── Professional action item formaliser ──────────────────────────────────────
/**
 * Converts raw action item text (informal chat) into a professionally worded
 * action description suitable for a BRD action register.
 */
const ACTION_DOMAIN_TEMPLATES = [
  { re: /vendor|third.?party|provider|aggregator|api.*vendor|agree.*api/i,
    desc: "Confirm integration API specifications, SLA commitments, authentication scheme, error-handling contracts, and fallback provisions with the selected third-party vendor. Obtain a signed contract or agreed statement of work before development commences." },
  { re: /consent|legal|compliance|regulatory|wording|form|policy|data.*protection/i,
    desc: "Submit the draft customer consent notice, data processing purpose statement, and data retention policy to the legal and compliance team for formal review. Obtain written sign-off on all consent framework components before implementation of the consent capture module begins." },
  { re: /salary|narration|pattern|bank.*format|format.*bank|income.*pattern/i,
    desc: "Compile and validate the initial salary narration pattern library covering all banks in scope for Phase 1. Define the governance process for maintaining and extending the pattern library post-go-live. Document known edge cases and the routing rules for unmatched narrations." },
  { re: /threshold|configur|rule|parameter|fraud.*rule|risk.*rule|rule.*set/i,
    desc: "Collaborate with the risk and fraud team to define and agree all configurable rule parameters, scoring thresholds, and risk escalation boundaries. Document the agreed baseline ruleset and the formal change control process for post-deployment rule amendments." },
  { re: /uat|test|testing|acceptance|scenario|test plan|test case/i,
    desc: "Develop and circulate the UAT test plan covering all defined acceptance criteria, regulatory scenarios, and edge cases. Confirm UAT participants, testing environment configuration, entry and exit criteria, and the defect management process before testing commences." },
  { re: /timeline|schedule|plan|milestone|delivery|sprint|roadmap|project plan/i,
    desc: "Prepare and circulate a detailed delivery plan with defined milestones, dependencies, and named owners. Identify and document all critical path items. Agree a formal change control process for any scope or timeline adjustments prior to sign-off." },
  { re: /stakeholder|sign.?off|approval|review.*feedback|confirm.*scope|meeting/i,
    desc: "Schedule a structured requirements review session with all key stakeholders to validate scope, priorities, and acceptance criteria. Document all agreed decisions and obtain formal written sign-off before development commences." },
  { re: /data.*model|schema|database|entity|design|architecture|technical.*design/i,
    desc: "Conduct a technical design session to finalise the data model, entity relationships, API contract, and overall system architecture. Document key design decisions using Architecture Decision Records (ADRs) and obtain senior technical review before implementation begins." },
  { re: /clarify|unclear|ambiguous|define|refine|detail|scope.*clarif/i,
    desc: "Schedule a targeted requirements clarification workshop to resolve all identified ambiguities. Document every decision with the rationale and obtain formal stakeholder sign-off on the refined requirements before development proceeds." },
  { re: /security|pen.*test|penetration|vulnerab|owasp/i,
    desc: "Engage the information security team to conduct a threat modelling session and define the security test scope. Schedule penetration testing for the pre-go-live phase and agree remediation SLAs for any identified vulnerabilities." },
];

function formaliseActionItem(rawText) {
  for (const { re, desc } of ACTION_DOMAIN_TEMPLATES) {
    if (re.test(rawText)) return desc;
  }
  // Fallback: clean and produce a professional action statement
  const cleaned = cleanToRequirement(rawText)
    .replace(/^(the system shall |next step[s]?[,:\s]*|we (need|should|must) )/i, "");
  return `${cap(cleaned.charAt(0).toLowerCase() + cleaned.slice(1))}. ` +
    "Assign a named owner, define measurable completion criteria, and track progress to closure at each milestone review.";
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
  list.push({ name: "Business Analyst",   role: "BRD Author / Requirements Owner" });
  list.push({ name: "IT Implementation",  role: "Technical Feasibility & Implementation" });
  return list;
}

function cap(str = "") { return str.charAt(0).toUpperCase() + str.slice(1); }

// ─── Text cleaner ─────────────────────────────────────────────────────────────
function cleanToRequirement(raw) {
  let text = String(raw)
    // Strip common conversational openers
    .replace(/^(next step[s]?[:\s,]*|action[:\s,]*|noted[.\s,]*|understood[.\s,]*|agreed[.\s,]*|sure[,\s]+|ok[ay]*[,.\s]+|thanks?[,.\s]+|yes[,.\s]+|no[,.\s]+|right[,.\s]+)/i, "")
    .replace(/^(do we have[^?]*\??\s*|have we [^?]*\??\s*|is there [^?]*\??\s*)/i, "")
    .replace(/^(so[,\s]+|well[,\s]+|basically[,\s]+|honestly[,\s]+|actually[,\s]+)/i, "")
    .replace(/^(just to clarify[,:\s]*|to confirm[,:\s]*|to summarise[,:\s]*|just checking[,:\s]*)/i, "")
    .replace(/^(from (my|our|the) (side|end|perspective)[,:\s]*)/i, "")
    .replace(/^(as (mentioned|discussed|agreed)[,:\s]*)/i, "")
    .replace(/^(one more thing[,:\s]*|also[,:\s]+|additionally[,:\s]+|furthermore[,:\s]+)/i, "")
    // Convert informal first-person and second-person to formal third-person
    .replace(/\b(I've|we've)\b/gi, "the team has")
    .replace(/\b(I'll|we'll)\b/gi, "the team will")
    .replace(/\b(I'm|we're)\b/gi, "the system is")
    .replace(/\b(I |me )\b/gi, "the organisation ")
    .replace(/\b(my |our )\b/gi, "the organisation's ")
    .replace(/\b(we need to|we should|we must|we want to)\b/gi, "the system shall")
    .replace(/\b(you need to|you should|you must)\b/gi, "the system shall")
    .replace(/\b(we are|we have)\b/gi, "the system")
    // Clean up leading existence phrases
    .replace(/^(also\s+)?(noticing|noticed|aware that|seeing that|there is a concern that)\s+/i, "")
    .replace(/^(there are (some\s+)?issues? with|there (is|are) a problem with)\s+/i, "There are issues with ")
    // Clean informal phrase starters
    .replace(/^(so the idea is|the plan is|what (i|we) (want|need) is)[,:\s]*/i, "")
    .replace(/^(what happens when|what about|how about)[,:\s]*/i, "")
    // Strip trailing questions and informal closers
    .replace(/\?+$/, "")
    .replace(/\s*(right|correct|ok|okay|yeah)\s*\.?\s*$/i, "")
    // Normalise whitespace
    .replace(/\s+/g, " ").trim();
  if (text.length < 10) text = raw.trim();
  return cap(text);
}

// ─── Strict grounding system prompt (prevents hallucination) ─────────────────
const GROUNDING_SYSTEM = `You are a precise Business Analyst writing formal BRD documentation.

CRITICAL RULES — violating any of these is a failure:
1. Use ONLY information explicitly stated in the source discussion and documents provided.
2. Do NOT infer, assume, extrapolate, or add ANY information not present in the source material.
3. Do NOT use dates, vendor names, SLA values, or technical details unless they appear verbatim in the source.
4. If required information is missing, state "Not specified in the discussion" — never fill in a plausible value.
5. Never draw on training data about similar projects. Only this project's actual discussion matters.`;

// ─── Build the source context block injected into every grounded prompt ───────
function buildFullSourceContext(messages, requestInfo, documentText = "") {
  const submittedDate = requestInfo.created_at
    ? new Date(requestInfo.created_at).toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "Not provided";

  const msgBlock = messages.length
    ? messages.map((m, i) => `[${i + 1}] ${m.sender_name || "Participant"}: ${m.message_text}`).join("\n")
    : "(No messages provided)";

  const docBlock = documentText ? `\n\n=== ATTACHED DOCUMENTS ===\n${documentText}` : "";

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

// ─── Azure OpenAI text generation — grounded (preferred) ─────────────────────
async function generateGroundedText(prompt, sourceContext, maxTokens = 300) {
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
    console.warn("[BRD Generator] Grounded generation failed:", err.message);
    return "";
  }
}

// ─── Azure OpenAI text generation — legacy (used only for requirement rewriting) ─
async function generateText(prompt, maxTokens = 300) {
  try {
    const response = await azureClient.chat.completions.create({
      model:       process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:    [
        { role: "system", content: "You are a professional Business Analyst writing formal requirements documents. Be concise, precise, and use professional business language." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens:  maxTokens,
    });
    return response.choices[0].message.content?.trim() || "";
  } catch (err) {
    console.warn("[BRD Generator] Azure OpenAI generation failed:", err.message);
    return "";
  }
}

// ─── Formal requirement rewriter (fallback for unclustered messages) ──────────
// Domain-aware phrase-to-requirement transformations for common informal patterns
const INFORMAL_TO_REQUIREMENT = [
  [/^vendor costs have (gone up|increased)/i,           "track and manage third-party vendor costs and alert authorised personnel when costs exceed the agreed budget threshold"],
  [/^costs have (gone up|increased)/i,                  "provide cost visibility and budget tracking for all operational expenditures, with alerts when defined thresholds are exceeded"],
  [/^(inefficien(cy|cies) in|some inefficien)/i,        "identify, report, and support resolution of process inefficiencies in"],
  [/^there are (some\s+)?(issue[s]?|problem[s]?) with/i,"log, track, and surface issues with"],
  [/^(need[s]? to|need a|need an)\s+/i,                 "provide "],
  [/^(want[s]? to|would like to)\s+/i,                  "enable users to "],
  [/^(allow[s]? user[s]? to|let[s]? user[s]? )/i,      "enable authorised users to "],
  [/^(should be able to|must be able to|has to be able to)/i, "enable authorised users to "],
  [/^(support[s]? the ability to)/i,                    "support "],
  [/^(provide[s]? (the|a|an) ability to)/i,             "provide the capability to "],
  [/^(make it (possible|easy) to)/i,                    "provide a user-friendly interface to "],
  [/^(ensure[s]? that )/i,                              "enforce that "],
  [/^(check[s]? (that|if|whether) )/i,                  "validate that "],
  [/^(track[s]?|monitor[s]?) /i,                        "record and report on "],
  [/^(send[s]?|notif(y|ies)|alert[s]?) /i,              "dispatch automated notifications for "],
  [/^(store[s]?|sav(e|es)|persist[s]?) /i,              "securely store and retrieve "],
  [/^(display[s]?|show[s]?|present[s]?) /i,             "display to authorised users "],
  [/^(generat(e[s]?|es?)|creat(e[s]?|es?)) /i,         "generate and make available "],
];

async function formaliseRequirement(text) {
  const cleaned = cleanToRequirement(text);
  if (/^the system shall/i.test(cleaned)) return cap(cleaned);

  // Try GPT-4o for a proper "The system shall…" rewrite
  const prompt = `Rewrite the following as a single concise formal business system requirement starting with exactly "The system shall". Return only the requirement sentence, nothing else.\n\nInput: ${cleaned.slice(0, 250)}`;
  const out    = await generateText(prompt, 120);
  if (
    out.length > 20 &&
    /^The system shall/i.test(out) &&
    out.length < 400 &&
    !/undefined|null/i.test(out)
  ) return cap(out);

  // Domain-aware phrase transformation
  let core = cleaned;
  for (const [re, replacement] of INFORMAL_TO_REQUIREMENT) {
    if (re.test(core)) {
      core = core.replace(re, replacement);
      break;
    }
  }
  // Strip leading filler that cleanToRequirement may have missed
  core = core
    .replace(/^the system shall /i, "")   // avoid double-prefix
    .replace(/^the organisation\s+(needs?|must|should|wants?)\s+/i, "")
    .replace(/^(there are (some\s+)?)/i, "");

  return `The system shall ${core.charAt(0).toLowerCase() + core.slice(1)}`;
}

// ─── Functional area definitions ──────────────────────────────────────────────
/**
 * Each area has:
 *  - id        unique area key
 *  - name      display name (becomes FR title)
 *  - signals   regex array for matching messages to this area
 *  - priority  MoSCoW default
 *  - build(matchedTexts, signals, keywords, requestInfo)  → { description, rationale }
 */
const FUNCTIONAL_AREAS = [
  {
    id: "upload",
    name: "Document Upload & Bank Statement Ingestion",
    signals: [/upload|pdf|statement|bank statement|document|attach|submit.*statement|import.*file/i],
    priority: "Must Have",
    build(_, signals) {
      const fmts = signals.input_formats?.length ? signals.input_formats.join(" and ") : "PDF";
      return {
        description:
          `The system shall provide a secure, customer-facing document upload interface that accepts bank statements in ${fmts} format. ` +
          `Uploaded documents shall be validated for file type compliance, maximum file size, and structural integrity prior to acceptance. ` +
          `Each successful upload shall generate a unique document reference identifier and trigger the automated parsing workflow. ` +
          `Upload progress shall be communicated to the customer in real time. Validation failures shall be surfaced with clear, actionable error messages. ` +
          `The raw document shall be discarded from storage immediately after extraction is complete, in line with data minimisation requirements.`,
        rationale:
          "Bank statement ingestion is the foundational step upon which all downstream income assessment and risk analysis depends. A reliable, secure upload mechanism is a prerequisite for every other functional capability in this initiative.",
      };
    },
  },
  {
    id: "parsing",
    name: "Third-Party Data Parsing & API Integration",
    signals: [/api|parse|extract.*data|third.?party|aggregator|integration|statement pars/i],
    priority: "Must Have",
    build(_, signals) {
      const vendor  = signals.vendors?.[0] || "the configured third-party parsing API";
      const formats = signals.output_formats?.length ? signals.output_formats.join(" / ") : "JSON";
      const sla     = signals.api_response_time || "the agreed response time SLA";
      return {
        description:
          `The system shall integrate with ${vendor} to extract structured transaction data from submitted bank statement documents. ` +
          `The integration shall be implemented as a secure, authenticated outbound REST API call. ` +
          `The API shall return a structured ${formats} payload containing categorised transaction records within ${sla}. ` +
          `The system shall implement configurable timeout handling: calls exceeding the SLA threshold shall trigger a fallback response and generate an operational alert. ` +
          `API credentials shall be stored as environment-scoped secrets and must not be embedded in source code or logs.`,
        rationale:
          "The parsing API is the primary data enrichment engine. Its reliability, response quality, and error handling directly determine the accuracy of the income assessment output.",
      };
    },
  },
  {
    id: "income_assessment",
    name: "Financial Data Extraction & Income Assessment Engine",
    signals: [/salary|income|calculate|average.*income|average.*salary|emi|obligation|bounce|narration|6 month|income assessment|credit.*identify/i],
    priority: "Must Have",
    build() {
      return {
        description:
          `The system shall execute an automated income assessment engine against the extracted transaction data. The engine shall: ` +
          `(a) identify salary credit narrations across supported bank formats using a configurable, maintainable pattern-matching library; ` +
          `(b) compute the applicant's average monthly income from salary credits over the most recent six-month period; ` +
          `(c) aggregate all existing EMI obligations identified in the transaction history to derive the net repayment capacity; ` +
          `(d) count cheque and NEFT return (bounce) incidents as a credit risk signal. ` +
          `The resulting financial summary — comprising average income, EMI total, bounce count, and assessment status — shall be stored as a structured record and used as the primary input for the eligibility determination workflow.`,
        rationale:
          "Accurate and standardised income assessment is the core business objective of this initiative. The calculation methodology must be consistent, configurable, auditable, and aligned with the organisation's credit policy to ensure sound lending decisions.",
      };
    },
  },
  {
    id: "fraud_risk",
    name: "Risk Assessment & Fraud Detection",
    signals: [/fraud|suspicious|cash deposit|irregular|inconsistent|pattern|anomal|detect.*risk|risk.*flag|bounce.*risk/i],
    priority: "Must Have",
    build() {
      return {
        description:
          `The system shall apply a configurable ruleset of fraud detection and risk indicators to the extracted transaction data. ` +
          `Suspicious signals — including high-value cash deposits within 90 days of application, sudden income drops exceeding defined thresholds, ` +
          `absent or highly irregular salary credits, and elevated bounce counts — shall be identified and attached to the case record as structured risk flags. ` +
          `Cases exceeding configurable risk score thresholds shall be automatically escalated to the risk review queue. ` +
          `All fraud detection rule configurations shall be manageable by authorised risk personnel without requiring a code deployment.`,
        rationale:
          "Fraud detection protects the organisation from credit risk and financial loss. Automated flagging ensures that high-risk applications receive appropriate scrutiny without creating operational bottlenecks for clean cases.",
      };
    },
  },
  {
    id: "consent",
    name: "Customer Consent Capture & Regulatory Compliance",
    signals: [/consent|permission|authoris|approval before|customer must agree|gdpr|regulatory|privacy/i],
    priority: "Must Have",
    build() {
      return {
        description:
          `The system shall obtain and record explicit, informed customer consent before initiating any bank data fetch or document processing. ` +
          `The consent capture interface shall clearly describe: the data to be accessed, the purpose of processing, the third parties involved, and the data retention policy. ` +
          `Consent records shall be timestamped, attributed to the authenticated customer session, and stored in an immutable log. ` +
          `Processing must not proceed — and the system must prevent API calls from being made — in the absence of a valid, recorded consent event. ` +
          `The consent framework shall be reviewed and approved by the legal/compliance team before implementation.`,
        rationale:
          "Explicit consent is a regulatory obligation under applicable data protection law. Failure to obtain and evidence consent exposes the organisation to regulatory enforcement action and reputational risk.",
      };
    },
  },
  {
    id: "routing",
    name: "Automated Case Routing & Manual Underwriting Workflow",
    signals: [/manual review|underwr|route|fallback|not detected|escalat|queue|assign.*case|case.*assign/i],
    priority: "Must Have",
    build() {
      return {
        description:
          `The system shall implement an automated case routing engine that directs each completed income assessment to the appropriate outcome path. ` +
          `Cases meeting all defined eligibility criteria shall be marked for automated progression. ` +
          `Cases where salary income cannot be reliably identified, where fraud risk indicators are flagged, or where data quality is insufficient ` +
          `shall be automatically routed to the manual underwriting queue with a structured case summary. ` +
          `The manual review interface shall present the assigned underwriter with all extracted financial data, risk flags, and a structured decision capture form. ` +
          `Routing decisions and manual overrides shall be fully logged for audit purposes.`,
        rationale:
          "Not all applications can be assessed automatically. A defined fallback routing mechanism ensures that edge cases and high-risk applications receive appropriate human review without creating operational ambiguity.",
      };
    },
  },
  {
    id: "notification",
    name: "Automated Notifications & Stakeholder Communication",
    signals: [/notif|alert|email|message.*customer|inform.*customer|communication|status.*update/i],
    priority: "Should Have",
    build() {
      return {
        description:
          `The system shall dispatch automated notifications to relevant parties at defined process milestones, including: ` +
          `document receipt confirmation, processing completion, assessment outcome (approved / referred / declined), and manual review routing. ` +
          `Notifications shall be delivered via the configured channel (email, SMS, or portal message) within a defined SLA. ` +
          `Failed notification attempts shall be retried up to three times before an operational alert is raised. ` +
          `Notification templates shall be configurable by authorised administrators without requiring a code change.`,
        rationale:
          "Timely, accurate communication maintains customer confidence and operational transparency. Automated notifications reduce manual follow-up effort and create a consistent, auditable communication trail.",
      };
    },
  },
  {
    id: "audit",
    name: "Audit Logging, Data Governance & Storage Policy",
    signals: [/audit|log.*action|track.*event|compliance.*log|store only|summary.*only|not.*store.*raw|derived.*value/i],
    priority: "Must Have",
    build() {
      return {
        description:
          `The system shall maintain a comprehensive, immutable audit log recording all significant events including: consent grants, document uploads, API calls, processing decisions, routing events, and manual review outcomes. ` +
          `Each audit record shall capture the actor identity, action performed, affected entities, input parameters, outcome, and UTC timestamp. ` +
          `Audit logs shall be stored in a separate, access-controlled data store and shall be read-only to all non-compliance roles. ` +
          `In alignment with the data minimisation principle, only derived financial summary values shall be persisted post-processing. ` +
          `Raw bank statement files and full transaction records shall not be retained beyond the active processing session.`,
        rationale:
          "A complete audit trail is a regulatory and legal requirement. Data minimisation (storing only derived summaries) reduces the organisation's data liability and simplifies compliance with data protection obligations.",
      };
    },
  },
];

/**
 * Dynamically extracts functional requirements from the actual discussion.
 * Replaces hardcoded FUNCTIONAL_AREAS matching — no bank-statement boilerplate injected.
 * Each FR is grounded strictly in what was discussed.
 */
async function buildFunctionalRequirementsFromContext(sourceContext, requirements) {
  const reqList = requirements.map((r, i) => `${i + 1}. ${r}`).join("\n");

  const prompt =
    `The following key requirements were extracted from the discussion:\n${reqList}\n\n` +
    `Based ONLY on the source discussion above and these requirements:\n` +
    `1. Group the requirements into logical functional areas (use names that reflect what was actually discussed).\n` +
    `2. For each functional area, write a comprehensive "The system shall..." requirement statement.\n` +
    `3. Assign a MoSCoW priority (Must Have / Should Have / Could Have / Won't Have) based on language in the discussion.\n\n` +
    `Return a JSON object:\n` +
    `{ "functional_requirements": [\n` +
    `  { "title": "<area name>", "description": "<formal The system shall... requirement>", "rationale": "<one sentence why this matters — from the discussion>", "priority": "<MoSCoW>", "source_messages": ["<verbatim quote from discussion that requires this>"] }\n` +
    `] }\n\n` +
    `Rules:\n` +
    `- Do NOT add functional areas not mentioned in the discussion.\n` +
    `- Do NOT use generic bank-statement, fraud, or income-assessment boilerplate unless the discussion explicitly discusses it.\n` +
    `- Every requirement must trace back to at least one message in the discussion.`;

  try {
    const res = await azureClient.chat.completions.create({
      model:           process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      messages:        [
        { role: "system", content: GROUNDING_SYSTEM },
        { role: "user",   content: `${sourceContext}\n\n${prompt}` },
      ],
      temperature:     0,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(res.choices[0].message.content || "{}");
    const items  = Array.isArray(parsed.functional_requirements) ? parsed.functional_requirements : [];

    return items.map((fr, i) => ({
      id:          `FR-${String(i + 1).padStart(3, "0")}`,
      title:       fr.title        || `Functional Requirement ${i + 1}`,
      description: fr.description  || "Not specified in the discussion.",
      rationale:   fr.rationale    || "",
      priority:    fr.priority     || "Must Have",
      source:      fr.source_messages?.join("; ") || "Key Stakeholder Discussion",
    }));
  } catch (err) {
    console.warn("[BRD Generator] Dynamic FR extraction failed:", err.message);
    // Fallback: formalise each requirement individually
    const frs = [];
    for (const [i, req] of requirements.entries()) {
      const formal = await formaliseRequirement(req);
      frs.push({
        id:          `FR-${String(i + 1).padStart(3, "0")}`,
        title:       formal.split(" ").slice(0, 8).join(" "),
        description: formal,
        rationale:   "",
        priority:    moscowPriority(req),
        source:      "Key Stakeholder Discussion",
      });
    }
    return frs;
  }
}

/**
 * Legacy: groups requirements by hardcoded FUNCTIONAL_AREAS.
 * Kept only for the `grouped` object used by buildGoals / buildScopeSection.
 */
function groupRequirementsByArea(requirements, allText, signals) {
  const matched = new Map();

  FUNCTIONAL_AREAS.forEach((area) => {
    const texts = requirements.filter((r) =>
      area.signals.some((re) => re.test(r))
    );
    if (texts.length > 0) matched.set(area.id, { area, texts });
  });

  FUNCTIONAL_AREAS.forEach((area) => {
    if (!matched.has(area.id) && area.signals.some((re) => re.test(allText))) {
      matched.set(area.id, { area, texts: [] });
    }
  });

  return [...matched.values()];
}

/**
 * Legacy buildFunctionalRequirements — kept only as internal fallback reference.
 * The main path now uses buildFunctionalRequirementsFromContext().
 */
async function buildFunctionalRequirements(requirements, allText, integrationSignals, keywords) {
  const grouped   = groupRequirementsByArea(requirements, allText, integrationSignals);
  const clusteredTexts = new Set(grouped.flatMap((g) => g.texts));
  const unclustered    = requirements.filter((r) => !clusteredTexts.has(r));

  const frs = [];
  let counter = 1;

  for (const { area, texts } of grouped) {
    const { description, rationale } = area.build(texts, integrationSignals, keywords);
    frs.push({
      id:          `FR-${String(counter++).padStart(3, "0")}`,
      title:       area.name,
      description,
      rationale,
      priority:    area.priority,
      source:      texts.length > 0 ? "Key Stakeholder Discussion" : "Domain Signal",
    });
  }

  for (const req of unclustered.slice(0, 4)) {
    const formal = await formaliseRequirement(req);
    frs.push({
      id:          `FR-${String(counter++).padStart(3, "0")}`,
      title:       formal.split(" ").slice(0, 8).join(" "),
      description: formal,
      rationale:   "",
      priority:    moscowPriority(req),
      source:      "Key Stakeholder Discussion",
    });
  }

  return frs;
}

// ─── Scope section builder ─────────────────────────────────────────────────────
/**
 * Produces a professional scope section:
 *  - summary    prose narrative (2-3 sentences)
 *  - in_scope   functional area descriptions (NOT raw chat messages)
 *  - out_of_scope
 *  - process_flow  end-to-end business process steps
 */
function buildScopeSection(grouped, requestInfo, allText, integrationSignals, complianceSignals) {
  const title    = requestInfo.title    || "this initiative";
  const category = requestInfo.category || "General";
  const domain   = category.toLowerCase();

  // In-scope = area names + brief descriptor
  const inScope = grouped.map(({ area }) => area.name);

  // Default if nothing matched
  if (inScope.length === 0) {
    inScope.push(
      "Core system functionality as described in the approved requirements",
      "User authentication, authorisation, and role-based access control",
      "Audit logging and compliance record management"
    );
  }

  // Out-of-scope defaults (can be overridden by detected exclusion language)
  const DEFAULT_OOS = [
    "Net banking direct fetch integration (deferred to Phase 2 pending regulatory clearance)",
    "Mobile native application — Phase 1 delivers a mobile-responsive web interface only",
    "Full bank statement archival — only derived financial summaries are stored post-processing",
    "Third-party credit bureau integration — separate initiative, not in scope for this delivery",
  ];

  const SCOPE_EXCLUDE_RE = /\b(not included|out of scope|excluded|won't|will not|future|phase 2|next release|later|deferred)\b/i;
  const detectedOOS = [];
  allText.split(/[.;]/).forEach((sentence) => {
    if (SCOPE_EXCLUDE_RE.test(sentence) && sentence.trim().length > 10)
      detectedOOS.push(cap(sentence.trim()));
  });
  const outOfScope = detectedOOS.length ? detectedOOS.slice(0, 4) : DEFAULT_OOS.slice(0, 3);

  // Scope summary narrative
  const areaCount  = inScope.length;
  const firstArea  = inScope[0]?.toLowerCase() ?? "data ingestion";
  const lastArea   = inScope[areaCount - 1]?.toLowerCase() ?? "audit and governance";
  const summary =
    `This initiative delivers an end-to-end ${domain} processing capability for "${title}". ` +
    `The system scope encompasses ${areaCount} core functional area${areaCount > 1 ? "s" : ""}, spanning ${firstArea} through to ${lastArea}. ` +
    `All items listed below constitute the Phase 1 delivery scope. Capabilities noted as out-of-scope are explicitly excluded and must not be included in the Phase 1 build or testing.`;

  // Business process flow
  const processFlow = buildProcessFlow(allText, integrationSignals, title);

  return { summary, in_scope: inScope, out_of_scope: outOfScope, process_flow: processFlow };
}

// ─── Business process flow builder ────────────────────────────────────────────
/**
 * Derives a numbered end-to-end business process flow from domain signals.
 * This is a high-level BUSINESS flow — not technical implementation steps.
 */
function buildProcessFlow(allText, integrationSignals, title) {
  const steps = [];

  const has = (re) => re.test(allText);

  if (has(/consent|permission|authoris|approval before/i)) {
    steps.push({
      step:    1,
      actor:   "Customer",
      action:  "Reviews the data access and processing consent notice and grants explicit approval",
      outcome: "Consent record created with timestamp and session attribution; processing unlocked",
    });
  }

  if (has(/upload|pdf|statement|document/i)) {
    steps.push({
      step:    steps.length + 1,
      actor:   "Customer",
      action:  "Uploads bank statement(s) via the portal interface",
      outcome: "Document validated; unique reference ID generated; parsing workflow triggered",
    });
  } else {
    steps.push({
      step:    steps.length + 1,
      actor:   "User",
      action:  "Initiates the business process and submits required inputs via the system interface",
      outcome: "Inputs validated; processing workflow initiated",
    });
  }

  if (has(/validate|format|integrity|size/i) || has(/upload/i)) {
    steps.push({
      step:    steps.length + 1,
      actor:   "System",
      action:  "Validates uploaded document for file type, size constraints, and structural integrity",
      outcome: "Document accepted or rejected with a descriptive error message returned to the customer",
    });
  }

  if (integrationSignals?.has_api_integration || has(/api|parse|third.?party|aggregator/i)) {
    steps.push({
      step:    steps.length + 1,
      actor:   "System",
      action:  "Submits validated document to the configured third-party parsing API via secure, authenticated REST call",
      outcome: "Structured transaction JSON received — salary credits, EMIs, balances, and bounce events categorised",
    });
  }

  if (has(/salary|income|calculate|average|emi|obligation|bounce/i)) {
    steps.push({
      step:    steps.length + 1,
      actor:   "System",
      action:  "Executes the income assessment engine: identifies salary credits, calculates 6-month average income, aggregates EMI obligations, counts bounce events",
      outcome: "Financial summary record created and stored; assessment status set",
    });
  }

  if (has(/fraud|suspicious|risk|irregular|cash deposit/i)) {
    steps.push({
      step:    steps.length + 1,
      actor:   "System",
      action:  "Applies fraud detection rules and risk scoring to the extracted transaction data",
      outcome: "Risk flags attached to case record; high-risk cases marked for escalation",
    });
  }

  if (has(/manual review|underwr|route|fallback|queue/i)) {
    steps.push({
      step:    steps.length + 1,
      actor:   "System",
      action:  "Routes the case based on assessment outcome: eligible cases progress automatically; insufficient or flagged cases are directed to the manual underwriting queue",
      outcome: "Case status updated; underwriter assigned and notified if manual review is required",
    });
  }

  if (has(/notif|alert|email|inform/i)) {
    steps.push({
      step:    steps.length + 1,
      actor:   "System",
      action:  "Dispatches automated notification to the customer and relevant internal stakeholders with the assessment outcome",
      outcome: "Notification delivered within SLA; delivery confirmed and logged",
    });
  }

  steps.push({
    step:    steps.length + 1,
    actor:   "System",
    action:  "Writes a complete, immutable audit log entry recording all actors, decisions, API interactions, and timestamps for this processing cycle",
    outcome: "Compliance record created; audit trail closed for this case",
  });

  // Re-number sequentially
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}

// ─── Executive summary — grounded generation ──────────────────────────────────
async function generateExecutiveSummary(analysis, requestInfo, integrationSignals, complianceSignals, sourceContext) {
  const submittedDate = requestInfo.created_at
    ? new Date(requestInfo.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    : "Not specified";

  const prompt =
    `Write a professional 3-sentence executive summary for a Business Requirements Document.\n` +
    `Use ONLY the information provided in the source context above. Do not add details not present there.\n` +
    `Include: (1) the business problem from the discussion, (2) the proposed solution scope, (3) the expected benefit.\n` +
    `Use ${submittedDate} as the document date if dates are referenced. Do NOT invent dates.\n` +
    `Executive Summary (3 sentences only):`;

  const aiOut = await generateGroundedText(prompt, sourceContext, 200);
  if (aiOut.length > 60 && !aiOut.includes("undefined")) return aiOut;

  // Structured fallback using only what we know from the request record
  const title    = requestInfo.title    || "this initiative";
  const category = requestInfo.category || "General";
  const priority = requestInfo.priority || "Medium";

  return (
    `This Business Requirements Document defines the scope and functional requirements for the "${cap(title)}" initiative submitted on ${submittedDate}. ` +
    `The ${category} domain requirement has been raised at ${priority} priority to address the business need described by the stakeholder. ` +
    `Delivery of this initiative is expected to resolve the identified gaps and provide measurable value to the organisation.`
  );
}

// ─── Business objective — grounded SMART template ─────────────────────────────
async function generateObjective(analysis, requestInfo, grouped, sourceContext) {
  const prompt =
    `Write a 2-sentence SMART business objective for this project.\n` +
    `Use ONLY the business problem and goals stated in the source context above.\n` +
    `State: (1) the specific business purpose from the discussion, (2) a measurable outcome grounded in what was discussed.\n` +
    `Do NOT invent metrics, percentages, or goals not mentioned in the discussion.\n` +
    `Objective (2 sentences only):`;

  const aiOut = await generateGroundedText(prompt, sourceContext, 150);
  if (aiOut.length > 30 && !aiOut.includes("undefined") && !/^(write|provide)/i.test(aiOut))
    return aiOut;

  const title    = requestInfo.title    || "this initiative";
  const category = requestInfo.category || "General";
  return (
    `To deliver the "${cap(title)}" capability as described by the stakeholder in the ${category} domain. ` +
    `Success will be measured by the fulfilment of the requirements stated in this document and acceptance by the stakeholder.`
  );
}

// ─── Goals derivation ─────────────────────────────────────────────────────────
function buildGoals(grouped, requestInfo, integrationSignals, complianceSignals) {
  const goals = [];
  const title  = requestInfo.title || "the initiative";

  goals.push(`Deliver an end-to-end, automated ${(requestInfo.category || "business").toLowerCase()} processing workflow from ${grouped[0]?.area.name.toLowerCase() ?? "data ingestion"} to ${grouped[grouped.length - 1]?.area.name.toLowerCase() ?? "audit logging"}`);

  if (grouped.some((g) => g.area.id === "income_assessment" || g.area.id === "fraud_risk"))
    goals.push("Eliminate manual data extraction effort through automated income assessment and risk scoring, with configurable rules maintained by the business team");

  if (integrationSignals?.has_api_integration)
    goals.push(`Establish reliable, SLA-governed third-party API integration for real-time bank statement data enrichment`);

  if (complianceSignals?.consent_required || complianceSignals?.storage_restricted)
    goals.push("Achieve full regulatory compliance — including customer consent capture and data minimisation — from the first production release");

  goals.push("Maintain complete, immutable audit traceability for every processing decision to support regulatory review and internal governance requirements");

  return goals.slice(0, 5);
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
    `Write an improved 3-sentence professional executive summary covering: problem, solution, benefit:`;
  const newExecSummary = await generateText(execPrompt, 150);

  const existingReqTexts = ex.functional_requirements.items.map((fr) => fr.description);
  const extractReqPrompt = `From these stakeholder review comments, extract any new system requirements: "${commentsText}". List each as a brief requirement. If none, say "none".`;
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
      id:          `FR-${String(i + 1).padStart(3, "0")}`,
      title:       ex.functional_requirements.items[i]?.title ?? formal.split(" ").slice(0, 8).join(" "),
      description: formal,
      rationale:   ex.functional_requirements.items[i]?.rationale ?? "",
      priority:    moscowPriority(req),
      source:      isNew ? `Stakeholder Feedback (v${newVersion})` : ex.functional_requirements.items[i]?.source ?? "Key Conversation (Revised)",
    });
  }

  const newRisks = [...ex.risk_register.items];
  improvementComments
    .filter((c) => /risk|concern|problem|issue|challenge|gap|miss|fail|wrong|unclear/i.test(c.comment))
    .forEach((c, i) => {
      const isDup = newRisks.some((r) => r.description.toLowerCase().slice(0, 30) === c.comment.toLowerCase().slice(0, 30));
      if (!isDup) {
        const { impact, probability } = assessRisk(c.comment);
        newRisks.push({ id: `R-${String(ex.risk_register.items.length + i + 1).padStart(3, "0")}`, description: formaliseRisk(c.comment), impact, probability, mitigation: deriveMitigation(c.comment) });
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
      executive_summary: {
        ...ex.executive_summary,
        text: newExecSummary.length > 40 && !newExecSummary.includes("undefined")
          ? newExecSummary
          : `${ex.executive_summary.text} This version incorporates ${improvementComments.length} stakeholder review(s).`,
      },
      functional_requirements:     { ...ex.functional_requirements, items: formalRequirements },
      non_functional_requirements: { ...ex.non_functional_requirements, items: nfrs },
      risk_register:               { ...ex.risk_register, items: newRisks },
    },
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateBRD(analysis, requestInfo, messages = [], documentText = "", approvedWorkflow = null) {
  const now        = new Date();
  const versionNum = "0.1";
  const docId      = `BRD-${requestInfo.req_number || requestInfo.id || "DRAFT"}-v${versionNum}`;

  // Build the single source-of-truth context for all grounded AI calls
  const sourceContext = buildFullSourceContext(messages, requestInfo, documentText);

  const allReqText     = [...(analysis.key_requirements || []), ...(analysis.action_items || [])].join(" ");
  const allConcernText = (analysis.stakeholder_concerns || []).join(" ");
  const allMsgText     = messages.map((m) => m.message_text).join(" ");
  const allText        = `${allReqText} ${allConcernText} ${allMsgText}`;

  const integrationSignals = analysis.integration_signals || {};
  const complianceSignals  = analysis.compliance_signals  || {};

  // ── 1. Group requirements (legacy — used only for goals + scope narrative)
  const grouped = groupRequirementsByArea(analysis.key_requirements || [], allText, integrationSignals);

  // ── 2. Parallel AI tasks (grounded) ─────────────────────────────────────
  const [execSummary, objective] = await Promise.all([
    generateExecutiveSummary(analysis, requestInfo, integrationSignals, complianceSignals, sourceContext),
    generateObjective(analysis, requestInfo, grouped, sourceContext),
  ]);

  // ── 3. Goals ─────────────────────────────────────────────────────────────
  const goals = buildGoals(grouped, requestInfo, integrationSignals, complianceSignals);

  // ── 4. Scope — use approved workflow steps if available, else derive ──────
  let scope;
  if (approvedWorkflow?.steps?.length) {
    // Use the BA-approved workflow steps as the process flow
    scope = buildScopeSection(grouped, requestInfo, allText, integrationSignals, complianceSignals);
    scope.process_flow = approvedWorkflow.steps;
    scope.summary = approvedWorkflow.workflow_title || scope.summary;
  } else {
    scope = buildScopeSection(grouped, requestInfo, allText, integrationSignals, complianceSignals);
  }

  // ── 5. Functional requirements — GROUNDED dynamic extraction ─────────────
  const formalRequirements = await buildFunctionalRequirementsFromContext(
    sourceContext,
    analysis.key_requirements || []
  );

  // ── 6. NFRs ──────────────────────────────────────────────────────────────
  const nfrs = inferNFRs(allText, complianceSignals).map((nfr, i) => ({
    id: `NFR-${String(i + 1).padStart(3, "0")}`,
    ...nfr,
  }));

  // ── 7. Business Rules ─────────────────────────────────────────────────────
  const businessRules = extractBusinessRules(allText).map((rule, i) => ({
    id:          `BR-${String(i + 1).padStart(3, "0")}`,
    description: rule,
  }));

  // ── 8. Integration Requirements ──────────────────────────────────────────
  const integrationRequirements = buildIntegrationRequirements(integrationSignals);

  // ── 9. Risk register ─────────────────────────────────────────────────────
  const risks = (analysis.stakeholder_concerns || []).map((concern, i) => {
    const { impact, probability } = assessRisk(concern);
    return {
      id:          `R-${String(i + 1).padStart(3, "0")}`,
      description: formaliseRisk(concern),
      impact,
      probability,
      mitigation:  deriveMitigation(concern),
    };
  });

  // ── 10. Stakeholders ──────────────────────────────────────────────────────
  const stakeholders = extractStakeholders(messages, requestInfo);

  // ── 11. Action items ──────────────────────────────────────────────────────
  const actionItems = (analysis.action_items || []).map((item, i) => ({
    id:          `A-${String(i + 1).padStart(3, "0")}`,
    description: formaliseActionItem(item),
    status:      "Open",
  }));

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
      ai_models:       [`Azure OpenAI ${process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o"} (classification + generation)`],
      source_messages: analysis.message_count,
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
        summary:      scope.summary,
        in_scope:     scope.in_scope,
        out_of_scope: scope.out_of_scope,
        process_flow: scope.process_flow,
      },
      stakeholders: {
        number: "4",
        title:  "Stakeholder Analysis",
        list:   stakeholders,
      },
      functional_requirements: {
        number: "5",
        title:  "Functional Requirements",
        items:  formalRequirements,
      },
      non_functional_requirements: {
        number: "6",
        title:  "Non-Functional Requirements",
        items:  nfrs,
      },
      business_rules: {
        number: "7",
        title:  "Business Rules",
        items:  businessRules,
      },
      integration_requirements: {
        number: "8",
        title:  "Integration Requirements",
        items:  integrationRequirements,
      },
      risk_register: {
        number: "9",
        title:  "Risk Register",
        items:  risks,
      },
      action_items: {
        number: "10",
        title:  "Action Items & Next Steps",
        items:  actionItems,
      },
      brd_readiness: {
        number: "11",
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
