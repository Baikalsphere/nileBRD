/**
 * FRD Generator — Converts an approved BRD JSON into a structured
 * Functional Requirements Document (FRD).
 *
 * Fully deterministic — no ML model required.
 *
 * Design principles:
 *  - FRD functional specs expand on BRD requirements with TECHNICAL HOW, not just WHAT
 *  - Acceptance criteria use proper Given / When / Then format
 *  - Workflows are domain-specific and derived from actual FR content
 *  - Integration specs are detailed with endpoint, auth, SLA, and error handling
 *  - Data entities are domain-aware with proper constraints
 *
 * Sections produced:
 *  1. Document Overview
 *  2. Functional Specifications (one FS per BRD FR, with AC + business rules)
 *  3. System Behaviour & Workflows
 *  4. Data Requirements (inferred entities)
 *  5. User Interface Requirements
 *  6. Integration Requirements
 *  7. Technical & Non-Functional Requirements
 *  8. Requirements Traceability Matrix
 */

function pad(n, len = 3) { return String(n).padStart(len, "0"); }
function cap(s = "") { return s.charAt(0).toUpperCase() + s.slice(1); }

function frdDocId(brdDocId) { return brdDocId.replace(/^BRD-/, "FRD-"); }

// ─── Acceptance criteria — Given/When/Then format ─────────────────────────────
function deriveAcceptanceCriteria(desc, priority, frTitle = "") {
  const criteria = [];
  const action = desc
    .toLowerCase()
    .replace(/^(the system shall |shall |must |should |will |the system )/i, "")
    .replace(/\.\s*$/, "")
    .trim()
    .slice(0, 100);

  // Primary given/when/then
  criteria.push(
    `Given the system is operational and the user is authenticated, when the user initiates the required action, then the system shall ${action}`
  );

  // Upload/document related
  if (/upload|document|pdf|statement|file|attach/i.test(desc)) {
    criteria.push("Given a valid PDF file within size limits, when uploaded, then the system shall return a unique document reference ID within 5 seconds");
    criteria.push("Given an invalid file type or oversized file, when uploaded, then the system shall reject the document and return a descriptive error message without processing it");
    criteria.push("Given a successful upload, then the document shall not be retained in storage beyond the processing session, in compliance with data minimisation policy");
  }

  // Parsing / API integration
  if (/parse|extract|api|integrat|third.?party|aggregator/i.test(desc)) {
    criteria.push("Given a valid document reference ID, when submitted to the parsing API, then a structured JSON response shall be returned within the agreed SLA");
    criteria.push("Given an API timeout or error response, then the system shall trigger the configured fallback behaviour and generate an operational alert without losing the case record");
    criteria.push("Given successful parsing, then the extracted transaction data shall be validated for completeness before income assessment proceeds");
  }

  // Income / financial assessment
  if (/income|salary|average|calculate|emi|bounce|assessment/i.test(desc)) {
    criteria.push("Given 6 months of transaction data, when processed, then the system shall correctly identify all salary credits and compute the average monthly income within a 1% tolerance of manual calculation");
    criteria.push("Given detected EMI transactions, then they shall be aggregated and deducted from gross income to produce a net repayment capacity figure");
    criteria.push("Given an application where salary cannot be reliably identified, then the case shall be automatically routed to the manual underwriting queue with the reason logged");
  }

  // Fraud / risk detection
  if (/fraud|risk|suspicious|irregular|flag|anomal/i.test(desc)) {
    criteria.push("Given transaction data containing a defined risk indicator, then the system shall attach a structured risk flag to the case record with the trigger reason");
    criteria.push("Given a case that exceeds the configurable risk threshold, then it shall be automatically escalated to the risk review queue without manual intervention");
    criteria.push("Given flagged cases, when reviewed by a risk officer, then all supporting evidence shall be presented in a structured, readable format");
  }

  // Consent management
  if (/consent|permission|authoris|approval/i.test(desc)) {
    criteria.push("Given a customer who has not granted consent, when attempting to access banking data, then the system shall block the request and prompt for consent capture");
    criteria.push("Given a completed consent grant, then a timestamped record shall be created with the customer ID, consent scope, and session reference within 2 seconds");
    criteria.push("Given a consent record, it shall be immutable and accessible only to authorised compliance roles");
  }

  // Routing / workflow
  if (/route|workflow|queue|manual|assign|review/i.test(desc)) {
    criteria.push("Given a completed assessment, when routing logic is applied, then the case shall be directed to the correct outcome path within 3 seconds of assessment completion");
    criteria.push("Given a case routed to manual review, then the assigned underwriter shall be notified immediately and the case shall appear in their queue");
    criteria.push("Given all routing decisions, then the routing reason and outcome shall be logged in the audit trail");
  }

  // Notifications
  if (/notif|alert|email|message/i.test(desc)) {
    criteria.push("Given a triggered notification event, when sent, then the notification shall be delivered within 5 minutes of the triggering event");
    criteria.push("Given a failed notification delivery, then the system shall retry up to 3 times before raising an operational alert");
  }

  // Audit / logging
  if (/audit|log|track|compliance|immutable/i.test(desc)) {
    criteria.push("Given any state-changing operation, then an audit record shall be created within 200 ms of the event, capturing actor, action, entity, and outcome");
    criteria.push("Given an audit record, it shall be read-only to all non-compliance roles and retained per the organisation's data governance policy");
  }

  // Must Have always gets these
  if (priority === "Must Have") {
    criteria.push("The feature shall maintain full functionality during agreed service hours without performance degradation under normal load");
    criteria.push("All data processed by this feature shall be accurately persisted and retrievable on demand with no data loss");
  }

  return [...new Set(criteria)].slice(0, 5);
}

// ─── Business rules derivation ────────────────────────────────────────────────
function deriveBusinessRules(desc, frTitle = "") {
  const rules = [];

  if (/upload|document|pdf|file/i.test(desc))
    rules.push(
      "Only PDF format bank statements are accepted in Phase 1. Other file formats shall be rejected at the point of upload with a clear error message",
      "Maximum file size per upload shall be enforced and configurable by administrators. Files exceeding the limit shall be rejected without partial processing"
    );

  if (/salary|income|average|6 month|narration/i.test(desc))
    rules.push(
      "Income assessment requires a minimum of 6 months of statement history. Submissions covering fewer than 6 months shall be flagged for manual review",
      "Average monthly income shall be computed from salary credits only. One-off or non-recurring credits shall not be included in the income calculation"
    );

  if (/emi|obligation|loan/i.test(desc))
    rules.push(
      "All identified EMI transactions shall be aggregated irrespective of lender. The total EMI obligation shall be deducted from average income to derive net repayment capacity",
      "EMI identification patterns shall be configurable to accommodate variations in transaction narration across different lenders"
    );

  if (/fraud|cash deposit|suspicious|risk/i.test(desc))
    rules.push(
      "Cash deposit amounts exceeding the defined threshold within 90 days of application shall automatically trigger a fraud review flag",
      "Fraud detection rule thresholds shall be configurable by authorised risk personnel without requiring a code deployment"
    );

  if (/consent|permission|authoris/i.test(desc))
    rules.push(
      "No bank data fetch or document processing may be initiated without a valid, recorded consent event for the specific customer and session",
      "Consent is valid for the duration of the application session only and must be re-obtained for any subsequent processing"
    );

  if (/route|manual|underwr|queue/i.test(desc))
    rules.push(
      "Routing decisions are determined by the assessment engine output and the current ruleset. Manual overrides of routing decisions must be captured with a justification comment",
      "Manual review queue assignments shall follow a configurable assignment policy (round-robin, skill-based, or manual)"
    );

  if (/audit|log|immutable/i.test(desc))
    rules.push(
      "Audit records shall be immutable once written. No update or delete operation shall be permitted on an existing audit entry",
      "Audit log access shall be restricted to the compliance role. Operational roles shall have no write or delete access to audit data"
    );

  if (/api|integrat|third.?party/i.test(desc))
    rules.push(
      "API calls to third-party services shall always be made over TLS 1.2 or higher. Plaintext HTTP calls are prohibited",
      "API credentials shall be stored as environment-level secrets and must not be logged, hardcoded, or included in source control"
    );

  if (rules.length === 0)
    rules.push(
      "All business logic shall be validated server-side. Client-side validation is supplementary and may not be the sole control",
      "All state-changing operations shall generate an audit record capturing actor, action, affected entity, and outcome"
    );

  return rules.slice(0, 3);
}

// ─── FRD functional spec description ─────────────────────────────────────────
/**
 * Expands a BRD FR into a richer FRD functional specification.
 * Adds HOW the system implements the requirement (at design level),
 * not just WHAT it does.
 */
function buildFsDescription(fr) {
  const desc  = fr.description || "";
  const title = fr.title       || "";

  // Document upload / ingestion
  if (/upload|document|pdf|statement.*ingestion|ingestion/i.test(title + " " + desc)) {
    return (
      `The system shall expose a secure document upload endpoint that accepts bank statement files in PDF format. ` +
      `The upload interface shall support drag-and-drop and file-picker selection. ` +
      `On receipt, the server shall: (1) verify the MIME type is application/pdf; (2) enforce the configured maximum file size limit; ` +
      `(3) generate a unique document reference UUID; (4) store the file in temporary, encrypted storage; ` +
      `(5) enqueue the document for asynchronous parsing. ` +
      `The API shall return the document reference ID and a processing status within 5 seconds of upload. ` +
      `Upload progress shall be surfaced to the customer via a real-time progress indicator. ` +
      `The raw document file shall be purged from storage immediately upon completion of data extraction.`
    );
  }

  // Parsing / API integration
  if (/pars|extract.*data|third.?party.*api|api.*integrat|aggregator/i.test(title + " " + desc)) {
    return (
      `The system shall invoke the configured third-party bank statement parsing API via an authenticated outbound REST call. ` +
      `The request shall include the document reference ID and the required authentication headers (API Key or Bearer Token as per vendor specification). ` +
      `The system shall await a structured JSON response containing categorised transaction records. ` +
      `The integration layer shall enforce a configurable timeout; responses exceeding the timeout shall trigger the fallback handler, ` +
      `which shall log the failure, update the case status to "Parsing Failed", and notify the operations team. ` +
      `API credentials shall be injected from environment-scoped secrets at runtime and shall not appear in application logs or source code. ` +
      `All API call metadata (timestamp, response time, status code) shall be written to the audit log.`
    );
  }

  // Income assessment / financial engine
  if (/income.*assessment|financial.*data.*extract|salary.*identif|assessment.*engine/i.test(title + " " + desc)) {
    return (
      `The system shall implement an income assessment service that processes the structured JSON output from the parsing API. ` +
      `The service shall: ` +
      `(1) apply a configurable salary narration pattern library to identify salary credit transactions across all supported bank formats; ` +
      `(2) compute the average monthly salary from identified credits over the most recent 6-month window; ` +
      `(3) aggregate all EMI-related debit transactions to determine total monthly obligations; ` +
      `(4) count cheque return and NEFT bounce events as credit risk signals; ` +
      `(5) compute the net repayment capacity as: average income − total EMI obligations. ` +
      `The resulting financial summary shall be persisted as a structured record linked to the case. ` +
      `All calculation inputs, outputs, and the applied pattern library version shall be logged for audit and reproducibility.`
    );
  }

  // Fraud / risk detection
  if (/fraud|risk.*assess|suspicious|anomal|risk.*detect/i.test(title + " " + desc)) {
    return (
      `The system shall implement a configurable fraud detection rules engine that evaluates extracted transaction data against a maintained ruleset. ` +
      `The engine shall evaluate, at a minimum: ` +
      `(1) cash deposit amounts and frequency relative to the defined threshold within the 90-day pre-application window; ` +
      `(2) salary credit irregularities including sudden drops exceeding the defined percentage threshold; ` +
      `(3) bounce counts relative to the risk scoring boundary. ` +
      `Each triggered rule shall generate a structured risk flag record containing the rule ID, trigger value, and threshold. ` +
      `The aggregate risk score shall determine the routing decision. ` +
      `All ruleset parameters shall be configurable by authorised risk personnel via an admin interface, without requiring a code deployment or service restart.`
    );
  }

  // Consent management
  if (/consent.*capture|consent.*manag|regulatory.*compliance|consent.*regulatory/i.test(title + " " + desc)) {
    return (
      `The system shall render a consent capture screen before any data processing is initiated. ` +
      `The screen shall present a plain-language description of: the data to be accessed, the processing purpose, the third parties involved, and the data retention policy. ` +
      `The customer shall explicitly confirm consent via a dedicated action (checkbox + confirm button). ` +
      `On confirmation, the system shall create a consent record containing: customer ID, session reference, consent scope, timestamp (UTC), and the version of the consent notice presented. ` +
      `The consent record shall be stored in the audit log and flagged as immutable. ` +
      `No downstream data fetch, API call, or processing workflow shall be initiated without a valid consent record for the current session. ` +
      `The legal/compliance team shall approve the consent notice wording before go-live.`
    );
  }

  // Routing / workflow
  if (/routing|workflow.*manag|case.*rout|manual.*underwr|underwriting.*workflow/i.test(title + " " + desc)) {
    return (
      `The system shall implement an automated routing engine that evaluates the completed income assessment and risk score against the configured eligibility ruleset. ` +
      `Cases meeting all criteria shall transition to the "Eligible — Proceed" state and be queued for the next workflow step. ` +
      `Cases that are ineligible or flagged shall be directed to the manual underwriting queue and assigned per the configured assignment policy. ` +
      `The manual review interface shall present the underwriter with: the extracted financial summary, all risk flags, the routing reason, and a structured decision form (Approve / Decline / Refer / Request More Information). ` +
      `All routing decisions — automated and manual — shall be logged with the decision rationale, actor, and timestamp. ` +
      `Manual overrides of automated routing outcomes shall require a mandatory justification comment.`
    );
  }

  // Notification
  if (/notif|communic|alert.*stakeholder/i.test(title + " " + desc)) {
    return (
      `The system shall trigger automated notification events at defined process milestones: ` +
      `document receipt, processing completion, assessment outcome, and manual review assignment. ` +
      `Notifications shall be dispatched via the configured delivery channel (email, SMS, or in-portal message) using the relevant template. ` +
      `Each notification shall be personalised with the customer's name, case reference, and the outcome or action required. ` +
      `Failed deliveries shall be retried up to 3 times with exponential back-off. ` +
      `Persistent delivery failures shall generate an operational alert for the support team. ` +
      `Notification templates shall be configurable by authorised administrators without requiring a code change or redeployment.`
    );
  }

  // Audit / governance
  if (/audit.*log|data.*governance|storage.*policy|immutable.*log/i.test(title + " " + desc)) {
    return (
      `The system shall write a structured audit record for every significant event in the processing pipeline. ` +
      `Each record shall include: event type, actor identity (user ID + role), affected entity (case ID, document ID), ` +
      `input parameters, outcome, and UTC timestamp. ` +
      `Audit records shall be written to a dedicated, access-controlled data store separate from operational tables. ` +
      `Write operations to the audit log shall be atomic and idempotent. ` +
      `No update or delete operation shall be permitted on existing audit entries. ` +
      `Read access to the audit log shall be restricted to users with the Compliance role. ` +
      `Derived summary data only (income average, EMI total, bounce count, risk score) shall be retained post-processing. ` +
      `Raw statement files and full transaction records shall be purged immediately after the processing session completes.`
    );
  }

  // Default: use original description, cleaned up for professional language
  const cleaned = desc.match(/^(the system shall |shall |must )/i)
    ? desc
    : `The system shall ${desc.toLowerCase().replace(/^(must|should|shall|will|the system|system)[ ,]*/i, "").trim()}`;

  return cleaned + (fr.rationale ? ` This capability is required because: ${fr.rationale.toLowerCase().replace(/\.$/, "")}.` : "");
}

// ─── Data entity inference ─────────────────────────────────────────────────────
function inferDataEntities(frs, category) {
  const entities = new Map();

  entities.set("User", {
    name: "User / System Actor",
    attributes: ["User ID (PK, UUID)", "Email Address (UNIQUE)", "Display Name", "Role (Enum)", "Department", "Is Active (Boolean)", "Created At (UTC)", "Last Login At (UTC)", "MFA Enabled (Boolean)"],
    constraints: ["Email must be unique across the system", "Role must be a member of the approved role enumeration", "Password must satisfy the minimum complexity policy", "Inactive users must not be permitted to authenticate"],
  });

  entities.set("Case", {
    name: "Application Case",
    attributes: ["Case ID (PK, UUID)", "Case Reference (UNIQUE)", "Applicant Customer ID (FK)", "Status (Enum)", "Assessment Outcome", "Risk Score", "Routing Decision", "Assigned Underwriter (FK→User)", "Created At (UTC)", "Updated At (UTC)"],
    constraints: ["Case Reference must follow the approved naming convention", "Status must follow the defined state machine transitions", "Routing Decision must be logged with a reason code"],
  });

  if (frs.some((fr) => /upload|document|pdf|statement/i.test(fr.description + (fr.title || "")))) {
    entities.set("Document", {
      name: "Bank Statement Document",
      attributes: ["Document ID (PK, UUID)", "Case ID (FK)", "File Reference (temp)", "MIME Type", "File Size (bytes)", "Upload Status (Enum)", "Uploaded By (FK→User)", "Uploaded At (UTC)", "Parsed At (UTC)", "Purged At (UTC)"],
      constraints: ["Only PDF MIME type is accepted in Phase 1", "File must not exceed the configured maximum size", "Raw file shall be purged immediately after extraction; Purged At must be populated"],
    });
  }

  if (frs.some((fr) => /income|salary|assessment|financial/i.test(fr.description + (fr.title || "")))) {
    entities.set("FinancialSummary", {
      name: "Financial Assessment Summary",
      attributes: ["Summary ID (PK, UUID)", "Case ID (FK, UNIQUE)", "Average Monthly Income (Decimal)", "Total EMI Obligations (Decimal)", "Net Repayment Capacity (Decimal)", "Bounce Count (Integer)", "Statement Period Start (Date)", "Statement Period End (Date)", "Assessment Status (Enum)", "Computed At (UTC)", "Pattern Library Version"],
      constraints: ["Summary is linked 1:1 to a Case", "All monetary amounts must be positive decimals in the agreed currency", "Statement period must cover a minimum of 6 months", "Raw transaction data must not be stored in this entity"],
    });
  }

  if (frs.some((fr) => /consent|permission|authoris/i.test(fr.description + (fr.title || "")))) {
    entities.set("ConsentRecord", {
      name: "Customer Consent Record",
      attributes: ["Consent ID (PK, UUID)", "Customer ID", "Session Reference", "Consent Scope", "Notice Version", "Granted (Boolean)", "Granted At (UTC)", "Revoked At (UTC, nullable)", "IP Address", "User Agent"],
      constraints: ["Consent record is immutable once created", "Revocation creates a new record; it does not modify the original grant", "Consent scope must match the processing purpose at point of use"],
    });
  }

  if (frs.some((fr) => /risk|fraud|flag|suspicious/i.test(fr.description + (fr.title || "")))) {
    entities.set("RiskFlag", {
      name: "Risk Flag",
      attributes: ["Flag ID (PK, UUID)", "Case ID (FK)", "Rule ID", "Rule Name", "Trigger Value", "Threshold Value", "Risk Score Contribution (Integer)", "Created At (UTC)"],
      constraints: ["Risk flags are immutable once created", "Each flag must reference a valid, active rule ID", "Risk score contribution must be a non-negative integer"],
    });
  }

  entities.set("AuditLog", {
    name: "Audit Log Entry",
    attributes: ["Entry ID (PK, UUID)", "Event Type (Enum)", "Actor User ID (FK→User)", "Actor Role", "Entity Type", "Entity ID", "Action", "Input Payload (JSON)", "Outcome", "Created At (UTC, indexed)"],
    constraints: ["Audit entries are immutable — no UPDATE or DELETE is permitted", "Read access is restricted to the Compliance role only", "Entry ID must be globally unique"],
  });

  return Array.from(entities.values());
}

// ─── Domain-specific workflow derivation ──────────────────────────────────────
function deriveWorkflows(brd) {
  const frs    = brd.sections.functional_requirements.items;
  const title  = brd.meta.title;
  const scope  = brd.sections.scope;
  const processFlow = scope?.process_flow || [];
  const workflows   = [];

  // Primary end-to-end workflow — use process flow from BRD if available
  if (processFlow.length > 0) {
    workflows.push({
      id:               "WF-001",
      name:             `${title} — End-to-End Processing Workflow`,
      trigger:          "Customer initiates a new application or an authorised user triggers the business process via the system interface",
      steps:            processFlow.map((s) => `[${s.actor}] ${s.action}`),
      expected_outcome: "Application fully processed, assessment outcome recorded, all parties notified, and complete audit trail written",
    });
  } else {
    workflows.push({
      id:               "WF-001",
      name:             `${title} — Primary Business Workflow`,
      trigger:          "User authenticates and initiates the primary business process via the system interface or API",
      steps: [
        "[Customer] Authenticates via the portal and initiates a new application",
        "[System] Validates authentication and directs the user to the appropriate workflow entry point",
        "[Customer] Completes required input steps (consent, document upload, data submission)",
        "[System] Validates inputs against defined business rules and constraints",
        "[System] Executes the core processing logic and derives the assessment outcome",
        "[System] Routes the case to the appropriate outcome path (automated or manual review)",
        "[System] Dispatches notifications to relevant stakeholders with the outcome",
        "[System] Writes a complete audit log entry for the processing cycle",
      ],
      expected_outcome: "Business case fully processed, all stakeholders notified, audit trail complete",
    });
  }

  // Domain-specific sub-workflows from FR content
  if (frs.some((fr) => /upload|document|pdf/i.test(fr.description + (fr.title || "")))) {
    workflows.push({
      id:      "WF-002",
      name:    "Document Upload & Validation Sub-Workflow",
      trigger: "Customer selects and submits a bank statement document via the upload interface",
      steps: [
        "[Customer] Selects a PDF file via drag-and-drop or file picker",
        "[System] Validates file type (must be application/pdf) and file size (within configured limit)",
        "[System] Rejects invalid files immediately with a descriptive error message — no further processing",
        "[System] For valid files: generates a unique document reference UUID",
        "[System] Stores the file in temporary, encrypted storage and enqueues for parsing",
        "[System] Returns the document reference ID and 'Processing' status to the customer within 5 seconds",
        "[System] On processing completion, updates document status and triggers the next workflow step",
        "[System] Purges the raw document file from temporary storage immediately after extraction",
      ],
      expected_outcome: "Valid document accepted, reference ID issued, parsing triggered, and raw file purged post-processing",
    });
  }

  if (frs.some((fr) => /income|salary|assessment|financial/i.test(fr.description + (fr.title || "")))) {
    workflows.push({
      id:      "WF-003",
      name:    "Income Assessment Engine Sub-Workflow",
      trigger: "Structured transaction JSON received from the parsing API for a validated case",
      steps: [
        "[System] Receives structured JSON payload from the parsing API and validates completeness",
        "[System] Applies the salary narration pattern library to identify salary credit transactions",
        "[System] Filters to the most recent 6-month window and computes the average monthly income",
        "[System] Identifies EMI-related debit transactions and computes the total monthly obligation",
        "[System] Counts cheque return and NEFT bounce events as risk signals",
        "[System] Computes net repayment capacity = average income − total EMI obligations",
        "[System] Persists the financial summary record (not raw transactions) with the pattern library version",
        "[System] Triggers the fraud detection engine on the same transaction dataset",
        "[System] Routes the case based on assessment outcome and fraud risk score",
      ],
      expected_outcome: "Financial summary computed, stored, and used as the primary input for eligibility and routing decisions",
    });
  }

  if (frs.some((fr) => /manual|underwr|route|queue/i.test(fr.description + (fr.title || "")))) {
    workflows.push({
      id:      "WF-004",
      name:    "Manual Review & Underwriting Decision Sub-Workflow",
      trigger: "Automated routing engine directs a case to the manual underwriting queue",
      steps: [
        "[System] Marks case status as 'Manual Review Required' and logs the routing reason",
        "[System] Assigns the case to an underwriter per the configured assignment policy",
        "[System] Notifies the assigned underwriter via the configured channel with the case reference",
        "[Underwriter] Opens the case in the review interface — all extracted data, risk flags, and routing reason presented",
        "[Underwriter] Reviews the financial summary, risk flags, and any supporting documentation",
        "[Underwriter] Captures decision (Approve / Decline / Refer / Request More Information) with a mandatory justification comment",
        "[System] Updates case status and triggers outcome notifications to the customer",
        "[System] Logs the underwriter decision, justification, and timestamp to the audit trail",
      ],
      expected_outcome: "Manual review case assessed by a qualified underwriter, decision recorded with full justification, customer notified, audit trail complete",
    });
  }

  return workflows;
}

// ─── UI screen derivation ─────────────────────────────────────────────────────
function deriveUIScreens(frs) {
  const screens = [];

  screens.push({
    name: "Application Dashboard",
    description: "Central hub showing active cases, pending actions, KPIs, and quick-access shortcuts for authenticated users",
    components: ["Active case count and status distribution", "Pending action items with urgency indicators", "Recent activity feed", "Quick launch buttons for common actions", "Role-specific navigation menu"],
  });

  if (frs.some((fr) => /consent/i.test(fr.description + (fr.title || "")))) {
    screens.push({
      name: "Customer Consent Capture Screen",
      description: "Regulatory-compliant consent screen presented before any data access or processing is initiated",
      components: ["Plain-language consent notice (versioned)", "Data access scope description", "Third-party disclosure statement", "Explicit consent checkbox", "Confirm Consent and Cancel action buttons", "Legal/compliance notice footer"],
    });
  }

  if (frs.some((fr) => /upload|document|pdf/i.test(fr.description + (fr.title || "")))) {
    screens.push({
      name: "Bank Statement Upload Interface",
      description: "Customer-facing document upload screen with real-time validation feedback and progress indication",
      components: ["Drag-and-drop file upload zone with browse button", "File type and size validation indicator", "Upload progress bar with percentage", "Document reference confirmation panel", "Processing status indicator (Uploading → Validating → Parsing → Complete)", "Error message panel with actionable guidance"],
    });
  }

  if (frs.some((fr) => /assessment|income|financial/i.test(fr.description + (fr.title || "")))) {
    screens.push({
      name: "Income Assessment Results View",
      description: "Structured display of the automated income assessment output for review by authorised users",
      components: ["Average monthly income display (prominent)", "EMI obligations breakdown table", "Net repayment capacity figure", "Bounce count indicator with risk level", "Risk flags summary panel", "Assessment status badge", "Audit trail link"],
    });
  }

  if (frs.some((fr) => /manual|underwr|queue|review/i.test(fr.description + (fr.title || "")))) {
    screens.push({
      name: "Manual Underwriting Review Interface",
      description: "Structured case review screen for assigned underwriters with full context and decision capture",
      components: ["Case summary header (reference, applicant, routing reason)", "Financial summary panel (income, EMI, net capacity, bounce count)", "Risk flags list with trigger values and thresholds", "Supporting document viewer", "Decision selector (Approve / Decline / Refer / Request More Info)", "Mandatory justification comment field", "Submit Decision button with confirmation dialog", "Case history and previous review notes"],
    });
  }

  screens.push({
    name: "Audit Log Viewer (Compliance Role)",
    description: "Read-only, filtered view of the immutable audit trail for compliance and governance review",
    components: ["Date range filter and event type filter", "Structured audit log table (timestamp, actor, action, outcome)", "Case reference deep-link", "Export to CSV for regulatory reporting", "Entry detail panel (full payload view)"],
  });

  return screens;
}

// ─── Integration requirement derivation ──────────────────────────────────────
function deriveIntegrations(frs, brdIntegrations = []) {
  const items = [];

  // 1. Promote BRD integration_requirements directly
  brdIntegrations.forEach((intReq) => {
    items.push({
      id:          `INT-${pad(items.length + 1)}`,
      system:      intReq.system,
      type:        intReq.direction || intReq.type || "REST API",
      input:       intReq.input,
      output:      intReq.output,
      auth:        intReq.auth,
      sla:         intReq.sla,
      description: intReq.description,
    });
  });

  // 2. Pattern-based additions from FR content
  if (frs.some((fr) => /upload|pdf|bank statement|document/i.test(fr.description + (fr.title || ""))) &&
      !items.some((i) => /upload|document/i.test(i.system)))
    items.push({
      id:          `INT-${pad(items.length + 1)}`,
      system:      "Document Upload & Temporary Storage Service",
      type:        "Inbound",
      input:       "PDF file (multipart/form-data, max size per policy)",
      output:      "Document reference ID (UUID) + processing status",
      auth:        "JWT Bearer Token (authenticated user session)",
      sla:         "Upload acknowledgement < 5 s; full processing completion < 30 s",
      description: "Inbound HTTP/S endpoint accepting customer bank statement uploads. Validates file type and size, generates a UUID reference, stores the file in encrypted temporary storage, and enqueues the document for asynchronous parsing. The raw file is purged immediately upon extraction completion.",
    });

  if (frs.some((fr) => /parse|extract|salary|transaction|income|emi|bounce/i.test(fr.description + (fr.title || ""))) &&
      !items.some((i) => /pars|aggregat|statement api/i.test(i.system)))
    items.push({
      id:          `INT-${pad(items.length + 1)}`,
      system:      "Bank Statement Parsing API (Account Aggregator / Third-Party Vendor)",
      type:        "Outbound",
      input:       "Document reference ID or PDF payload",
      output:      "JSON — salary credits, EMI debits, bounces, balances, categorised transactions",
      auth:        "Secure API Key (environment secret)",
      sla:         "Response within 8–10 seconds; timeout triggers fallback handler",
      description: "Outbound REST integration with the configured third-party parsing API. Submits the validated bank statement and receives a structured JSON payload containing categorised transaction data. Timeout and error handling are fully configured. API call metadata (timestamp, response code, latency) is written to the audit log.",
    });

  if (frs.some((fr) => /consent|permission/i.test(fr.description + (fr.title || ""))) &&
      !items.some((i) => /consent/i.test(i.system)))
    items.push({
      id:          `INT-${pad(items.length + 1)}`,
      system:      "Customer Consent Management Service",
      type:        "Bidirectional",
      input:       "Customer ID + consent scope + session reference",
      output:      "Consent record (granted/denied) + consent ID + timestamp",
      auth:        "JWT Bearer Token",
      sla:         "Consent record creation < 2 s; consent validation check < 500 ms",
      description: "Records and validates customer consent events before any data processing. Each consent grant creates an immutable record. The consent validation check is invoked as a pre-condition gate on all data fetch and processing operations.",
    });

  if (frs.some((fr) => /email|notif|alert/i.test(fr.description + (fr.title || ""))) &&
      !items.some((i) => /email|notif/i.test(i.system)))
    items.push({
      id:          `INT-${pad(items.length + 1)}`,
      system:      "Email / Notification Delivery Service",
      type:        "Outbound",
      input:       "Notification event payload + recipient details + template ID",
      output:      "Delivery receipt or failure code",
      auth:        "SMTP credentials or provider API Key (environment secret)",
      sla:         "Delivery within 5 minutes of triggering event; retry up to 3× on failure",
      description: "Sends transactional notifications for key process milestones. Supports email and configurable channels. Failed deliveries are retried with exponential back-off; persistent failures raise an operational alert. Templates are configurable by authorised admins.",
    });

  if (frs.some((fr) => /audit|log|track/i.test(fr.description + (fr.title || ""))) &&
      !items.some((i) => /audit/i.test(i.system)))
    items.push({
      id:          `INT-${pad(items.length + 1)}`,
      system:      "Audit & Compliance Logging Service",
      type:        "Outbound (internal)",
      input:       "Structured audit event (JSON) — actor, action, entity, outcome, timestamp",
      output:      "Immutable audit log entry + entry ID",
      auth:        "Internal service token (not externally exposed)",
      sla:         "Log write < 200 ms; asynchronous fan-out to compliance store",
      description: "Receives structured audit events from all system services and writes them to the immutable compliance log. Supports filtering and export for regulatory reporting. Access is restricted to the Compliance role.",
    });

  if (items.length === 0) {
    items.push({
      id: "INT-001", system: "PostgreSQL Database", type: "Internal",
      input: "Parameterised SQL queries", output: "Typed resultsets",
      auth: "Connection pool with credential rotation", sla: "Query P95 < 500 ms",
      description: "Primary persistent data store for all application entities. All queries are parameterised to prevent SQL injection. Connection pooling is managed by the application layer.",
    });
    items.push({
      id: "INT-002", system: "REST API Gateway", type: "Inbound",
      input: "HTTP/HTTPS request (JSON body)", output: "JSON response",
      auth: "JWT Bearer Token with role claims", sla: "P95 end-to-end < 2 s; rate-limited",
      description: "HTTP/HTTPS REST interface for all frontend-to-backend communication. JWT-authenticated, CORS-configured, rate-limited per user/IP. All requests and responses are logged at the gateway level.",
    });
  }

  return items;
}

// ─── NFR → technical spec mapping ─────────────────────────────────────────────
function mapNfrs(nfrs) {
  const specs = nfrs.map((nfr, idx) => ({
    id:          `NFR-${pad(idx + 1)}`,
    category:    nfr.category,
    requirement: nfr.description,
    metric:      deriveMetric(nfr.category),
  }));

  const cats = new Set(nfrs.map((n) => n.category.toLowerCase()));

  if (!cats.has("performance"))
    specs.push({ id: `NFR-${pad(specs.length + 1)}`, category: "Performance", requirement: "System shall respond to all standard user interactions within defined SLA targets under normal load conditions", metric: "API P95 latency < 2 s; page load < 3 s; DB query P95 < 500 ms; parsing API SLA as per vendor agreement" });
  if (!cats.has("security"))
    specs.push({ id: `NFR-${pad(specs.length + 1)}`, category: "Security", requirement: "All data transmissions shall be encrypted in transit. Access to all endpoints and data shall be controlled by role-based authorisation", metric: "TLS 1.2+ enforced; JWT expiry ≤ 24 h; account lockout after 5 consecutive failed authentications; quarterly penetration test" });
  if (!cats.has("availability"))
    specs.push({ id: `NFR-${pad(specs.length + 1)}`, category: "Availability", requirement: "System shall maintain high availability during agreed business hours. Planned maintenance shall be scheduled outside core hours", metric: "99.5% uptime SLA; RTO < 4 h; RPO < 1 h; all maintenance windows communicated 48 h in advance" });

  return specs;
}

function deriveMetric(category) {
  const m = {
    "performance":                    "P95 API response < 2 s; page load < 3 s; DB query < 500 ms",
    "security":                       "TLS 1.2+; zero critical CVEs at release; quarterly penetration test; OWASP Top 10 mitigated",
    "availability":                   "99.5% uptime SLA; RTO < 4 h; RPO < 1 h",
    "scalability":                    "Support 3× current peak concurrent load without SLA degradation",
    "compliance & audit":             "100% of state changes logged; audit records retained per policy; accessible to Compliance role on demand",
    "regulatory compliance & consent":"100% of data fetch operations gated on valid consent record; consent records retained for minimum 7 years",
    "data storage & privacy":         "0 raw statement files retained post-processing; storage verified by automated post-processing check",
    "maintainability":                "Code coverage ≥ 80%; deployment pipeline < 30 min; zero manual deployment steps",
    "usability":                      "Task completion rate ≥ 90% in UAT; WCAG 2.1 AA compliant; SUS score ≥ 70",
    "interoperability":               "All APIs documented in OpenAPI 3.0; breaking changes require major version bump; integration test suite maintained",
  };
  return m[category.toLowerCase()] ?? "Metrics to be defined and agreed in the acceptance test plan prior to UAT";
}

// ─── Main export ────────────────────────────────────────────────────────────────
export function generateFRD(brd, requestInfo) {
  const meta            = brd.meta;
  const s               = brd.sections;
  const frs             = s.functional_requirements.items;
  const nfrs            = s.non_functional_requirements?.items ?? [];
  const brdIntegrations = s.integration_requirements?.items   ?? [];

  const docId   = frdDocId(meta.doc_id);
  const effDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  // Build functional specifications — richer than BRD FRs
  const functionalSpecs = frs.map((fr, idx) => ({
    id:                  `FS-${pad(idx + 1)}`,
    brd_ref:             fr.id,
    title:               fr.title ?? (fr.description.split(" ").slice(0, 8).join(" ") + "…"),
    description:         buildFsDescription(fr),
    priority:            fr.priority,
    acceptance_criteria: deriveAcceptanceCriteria(fr.description, fr.priority, fr.title || ""),
    business_rules:      deriveBusinessRules(fr.description, fr.title || ""),
  }));

  const traceMatrix = frs.map((fr, idx) => ({
    brd_ref:     fr.id,
    frd_ref:     `FS-${pad(idx + 1)}`,
    description: (fr.title ?? fr.description).split(" ").slice(0, 14).join(" ") + "…",
  }));

  // Scope narrative from BRD
  const scopeSummary = s.scope?.summary || "";
  const inScopeItems = s.scope?.in_scope?.slice(0, 4).join("; ") || "as defined in the approved BRD";
  const outOfScopeItems = s.scope?.out_of_scope?.slice(0, 2).join("; ") || "items noted as out of scope in the BRD";

  return {
    meta: {
      doc_id:         docId,
      brd_doc_id:     meta.doc_id,
      title:          `${meta.title} — Functional Requirements Document`,
      version:        "1.0",
      status:         "Draft",
      category:       meta.category,
      priority:       meta.priority,
      effective_date: effDate,
      generated_at:   new Date().toISOString(),
      request_number: requestInfo.req_number ?? "",
      ai_note:        "AI-generated from approved BRD. Review all functional specifications, acceptance criteria, and integration details with your development and QA teams before implementation commences.",
    },
    sections: {
      overview: {
        title: "Document Overview",
        purpose:
          `This Functional Requirements Document (FRD) provides the detailed functional specifications required to design, build, and validate the "${meta.title}" solution. ` +
          `It is derived from and traceable to the approved Business Requirements Document (${meta.doc_id}) and translates business requirements into precise, implementable specifications for the technical delivery team. ` +
          `Where the BRD defines WHAT the system must do, this FRD defines HOW the system shall implement each requirement at a functional level.`,
        scope:
          `This FRD covers all functional specifications within the approved Phase 1 delivery scope: ${inScopeItems}. ` +
          `The following are explicitly excluded from this document and must not be implemented in Phase 1: ${outOfScopeItems}.`,
        audience: "Software Architects, Lead Developers, QA Engineers, Integration Specialists, Project Managers, IT Management",
      },
      functional_specifications: {
        title: "Functional Specifications",
        items: functionalSpecs,
      },
      system_behavior: {
        title:     "System Behaviour & Workflows",
        workflows: deriveWorkflows(brd),
      },
      data_requirements: {
        title:    "Data Requirements",
        entities: inferDataEntities(frs, meta.category),
      },
      ui_requirements: {
        title:   "User Interface Requirements",
        screens: deriveUIScreens(frs),
      },
      integration_requirements: {
        title: "Integration Requirements",
        items: deriveIntegrations(frs, brdIntegrations),
      },
      non_functional_requirements: {
        title: "Technical & Non-Functional Requirements",
        items: mapNfrs(nfrs),
      },
      traceability_matrix: {
        title:    "Requirements Traceability Matrix",
        mappings: traceMatrix,
      },
    },
  };
}
