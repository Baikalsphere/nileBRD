/**
 * FRD Generator — Converts an approved BRD JSON into a structured
 * Functional Requirements Document (FRD) using rule-based + template analysis.
 *
 * Fully deterministic — no ML model required, no memory overhead.
 *
 * Sections produced:
 *  1. Document Overview
 *  2. Functional Specifications (one FS per BRD FR, with acceptance criteria + business rules)
 *  3. System Behavior & Workflows
 *  4. Data Requirements (inferred entities)
 *  5. User Interface Requirements (inferred screens)
 *  6. Integration Requirements (inferred from keywords)
 *  7. Technical & Non-Functional Requirements
 *  8. Requirements Traceability Matrix (FR → FS)
 */

function pad(n, len = 3) {
  return String(n).padStart(len, "0");
}

function frdDocId(brdDocId) {
  return brdDocId.replace(/^BRD-/, "FRD-");
}

// ── Acceptance criteria derivation ────────────────────────────────────────────
function deriveAcceptanceCriteria(desc, priority) {
  const criteria = [
    `Given the system is operational, when the user triggers the required action, then the system shall ${desc
      .toLowerCase()
      .replace(/^(the system shall |shall |must |should |will )/i, "")
      .trim()}`,
  ];

  if (priority === "Must Have") {
    criteria.push("The feature shall be available during all agreed service hours without degradation");
    criteria.push("All processed data shall be accurately persisted and retrievable on demand");
  }
  if (/report|dashboard|view|display|show/i.test(desc)) {
    criteria.push("Displayed data shall be accurate and refreshed within 3 seconds of the user request");
    criteria.push("All values shall match the corresponding source records exactly");
  }
  if (/search|filter|find|query/i.test(desc)) {
    criteria.push("Search results shall return within 2 seconds for up to 10,000 records");
    criteria.push("Results shall be paginated with a maximum of 50 items per page");
  }
  if (/notif|alert|email|message/i.test(desc)) {
    criteria.push("Notifications shall be delivered within 5 minutes of the triggering event");
    criteria.push("Failed notifications shall be retried up to 3 times before an alert is raised");
  }
  if (/upload|import|export|download/i.test(desc)) {
    criteria.push("File operations shall support files up to 50 MB with visible progress indicators");
    criteria.push("Unsupported file types shall be rejected with a clear error message");
  }
  if (/auth|login|access|permission|role/i.test(desc)) {
    criteria.push("Access control shall be enforced at every system entry point");
    criteria.push("Unauthorised access attempts shall be logged and reported to administrators");
  }

  return criteria;
}

// ── Business rules derivation ──────────────────────────────────────────────────
function deriveBusinessRules(desc) {
  const rules = [];

  if (/approval|approve|authoris/i.test(desc))
    rules.push(
      "Approval workflows shall require at least one designated approver before a record is actioned",
      "Approved records shall become immutable without a formal re-approval workflow"
    );
  if (/budget|cost|financ|spend/i.test(desc))
    rules.push(
      "Financial transactions shall not exceed the approved budget allocation for the period",
      "All budget modifications shall require documented justification and manager sign-off"
    );
  if (/vendor|supplier|contract/i.test(desc))
    rules.push(
      "Vendor records shall be validated against the approved vendor register before use",
      "Contract expiry dates shall trigger automatic renewal notifications 30 days in advance"
    );
  if (/deadline|due|schedule|sla/i.test(desc))
    rules.push("Items overdue by more than 5 business days shall trigger an automatic escalation notification");
  if (/user|customer|client|person/i.test(desc))
    rules.push("All personal data shall be handled in compliance with applicable data protection regulations");

  if (rules.length === 0)
    rules.push(
      "All business logic shall be validated server-side regardless of any client-side validation",
      "Audit logs shall be created for every state-changing operation"
    );

  return rules;
}

// ── Data entity inference ─────────────────────────────────────────────────────
function inferDataEntities(frs, category) {
  const entities = new Map();

  entities.set("User", {
    name: "User",
    attributes: ["User ID (PK)", "Email Address (UNIQUE)", "Display Name", "Role", "Department", "Is Active", "Created At", "Last Login At"],
    constraints: ["Email must be unique across the system", "Role must belong to the approved role list", "Password must meet minimum complexity policy"],
  });

  entities.set("Request", {
    name: "Request / Business Problem",
    attributes: ["Request ID (PK)", "Request Number (UNIQUE)", "Title", "Description", "Priority", "Category", "Status", "Submitted By (FK→User)", "Assigned BA (FK→User)", "Created At", "Updated At"],
    constraints: ["Request Number must follow REQ-XXXX naming convention", "Status transitions must follow the approved state machine", "Priority must be defined at submission"],
  });

  if (/budget|financ|cost|spend/i.test(category) || frs.some((fr) => /budget|financ/i.test(fr.description))) {
    entities.set("Budget", {
      name: "Budget",
      attributes: ["Budget ID (PK)", "Reference Code", "Allocated Amount", "Spent Amount", "Currency (ISO)", "Fiscal Period", "Department", "Status", "Approved By (FK→User)", "Created At"],
      constraints: ["Amount must be a positive decimal", "Currency must be a valid ISO 4217 code", "Fiscal periods must not overlap for the same department"],
    });
  }

  if (/vendor|supplier|contract/i.test(category) || frs.some((fr) => /vendor|supplier/i.test(fr.description))) {
    entities.set("Vendor", {
      name: "Vendor / Supplier",
      attributes: ["Vendor ID (PK)", "Company Name", "Primary Contact Name", "Contact Email", "Status (Active/Inactive)", "Contract Start Date", "Contract End Date", "Approved By (FK→User)"],
      constraints: ["Vendor IDs must be unique", "Contract end date must be after start date", "Status must be Active or Inactive"],
    });
  }

  if (frs.some((fr) => /report|analytic|dashboard/i.test(fr.description))) {
    entities.set("Report", {
      name: "Report / Analytics",
      attributes: ["Report ID (PK)", "Name", "Type (Summary/Detailed/Scheduled)", "Parameters (JSON)", "Created By (FK→User)", "Created At", "Schedule (CRON)", "Last Run At"],
      constraints: ["Report names must be unique per user", "Parameters must conform to the report type schema", "Scheduled reports must have a valid CRON expression"],
    });
  }

  return Array.from(entities.values());
}

// ── Workflow derivation ───────────────────────────────────────────────────────
function deriveWorkflows(brd) {
  const frs = brd.sections.functional_requirements.items;
  const title = brd.meta.title;
  const workflows = [];

  workflows.push({
    id: "WF-001",
    name: `${title} — Primary Business Workflow`,
    trigger: "User initiates the primary business process via the system UI or API",
    steps: [
      "User authenticates and is directed to the appropriate module",
      "User provides required data inputs, selections, and attachments",
      "System validates all inputs against defined business rules and constraints",
      "System routes the submission through the configured approval chain",
      "Approver(s) review the submission and take action (approve / reject / return)",
      "System updates all relevant statuses and dispatches notifications",
      "System writes a complete audit log entry for compliance",
    ],
    expected_outcome: "Business request is fully processed, all parties notified, and the outcome recorded",
  });

  const actionFrs = frs.filter((fr) =>
    /generate|create|update|process|send|notify|report|submit|approve/i.test(fr.description)
  );

  actionFrs.slice(0, 3).forEach((fr, idx) => {
    const verb = (fr.description.match(/\b(generate|create|update|process|send|notify|report|submit|approve)\b/i)?.[0] ?? "process");
    workflows.push({
      id: `WF-${pad(idx + 2)}`,
      name: `${verb.charAt(0).toUpperCase() + verb.slice(1)} — ${fr.id} Sub-Workflow`,
      trigger: `System event or user action triggers the ${verb.toLowerCase()} operation`,
      steps: [
        `System validates preconditions for the ${verb.toLowerCase()} operation`,
        "Required data is fetched and integrity-checked from the data store",
        "Business rules and validation logic are applied",
        `${verb.charAt(0).toUpperCase() + verb.slice(1)} operation is executed atomically`,
        "Result is persisted; confirmation or error response is returned to the caller",
        "Audit entry is created recording the actor, action, timestamp, and outcome",
      ],
      expected_outcome: fr.description,
    });
  });

  return workflows;
}

// ── UI screen derivation ──────────────────────────────────────────────────────
function deriveUIScreens(frs) {
  const screens = [];

  screens.push({
    name: "Dashboard / Home",
    description: "Central hub showing KPIs, pending actions, recent activity, and quick-access shortcuts",
    components: ["Summary KPI stat cards", "Recent activity feed", "Quick action buttons", "Alert / notification panel", "Role-based navigation menu"],
  });

  if (frs.some((fr) => /submit|create|new|add|input|enter/i.test(fr.description))) {
    screens.push({
      name: "Submission / Creation Form",
      description: "Multi-step form for submitting new requests with real-time validation and file upload",
      components: ["Multi-step form wizard with progress indicator", "Inline validation error messages", "File attachment uploader (drag & drop)", "Priority and category selectors", "Submit and Save Draft action buttons"],
    });
  }

  if (frs.some((fr) => /list|view|search|filter|find|browse/i.test(fr.description))) {
    screens.push({
      name: "List / Management Table",
      description: "Searchable, filterable, and sortable table of all records with status indicators",
      components: ["Global search input", "Column-level filters (status, priority, date range)", "Sortable column headers", "Status badge indicators", "Row-level action menu (View / Edit / Delete)", "Pagination and page-size controls", "Export to CSV / PDF"],
    });
  }

  if (frs.some((fr) => /approval|review|authoris/i.test(fr.description))) {
    screens.push({
      name: "Approval / Review Interface",
      description: "Dedicated view for approvers to action pending items with full context",
      components: ["Pending items queue with urgency indicators", "Structured data / document viewer", "Approve / Reject / Return action buttons", "Comment and justification input", "Approval history timeline"],
    });
  }

  if (frs.some((fr) => /report|analytic|chart|trend|metric/i.test(fr.description))) {
    screens.push({
      name: "Analytics & Reporting",
      description: "Visual analytics dashboard with charts, trends, and downloadable reports",
      components: ["Date range picker", "Bar, line, and pie charts (Recharts)", "Tabular data view with export", "Saved report configurations", "Scheduled report management"],
    });
  }

  screens.push({
    name: "User Profile & Settings",
    description: "Account management, notification preferences, and activity log",
    components: ["Profile information editor", "Password / MFA management", "Notification preference toggles", "Session activity log", "Role and permission viewer"],
  });

  return screens;
}

// ── Integration requirement derivation ────────────────────────────────────────
/**
 * Derives integration specs from FRD functional specs AND from the BRD
 * integration_requirements section (which is passed as brdIntegrations).
 */
function deriveIntegrations(frs, brdIntegrations = []) {
  const items = [];

  // 1. Promote BRD integration_requirements directly into FRD integration specs
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

  // 2. Pattern-based additions from FR descriptions (financial/banking)
  if (frs.some((fr) => /upload|pdf|bank statement|document/i.test(fr.description)) && !items.some((i) => /upload|document/i.test(i.system)))
    items.push({ id: `INT-${pad(items.length + 1)}`, system: "Document Upload & Storage Service", type: "Inbound", input: "PDF (up to 50 MB)", output: "Document reference ID + parsed data", auth: "JWT Bearer", sla: "Upload ACK < 5 s; processing < 30 s", description: "Handles customer bank statement PDF uploads. Validates file type and size, stores the file temporarily during processing, then discards the raw document after data extraction." });

  if (frs.some((fr) => /parse|extract|salary|transaction|income|emi|bounce/i.test(fr.description)) && !items.some((i) => /pars|aggregat|statement api/i.test(i.system)))
    items.push({ id: `INT-${pad(items.length + 1)}`, system: "Bank Statement Parsing API (Account Aggregator)", type: "Outbound", input: "PDF bank statement", output: "JSON — salary credits, EMIs, bounces, average balance", auth: "Secure API Key", sla: "Response within 8–10 seconds", description: "Third-party REST API that parses uploaded PDF bank statements and returns structured JSON transaction data including salary credits, EMI obligations, and flagged anomalies." });

  if (frs.some((fr) => /consent|customer consent|permission/i.test(fr.description)) && !items.some((i) => /consent/i.test(i.system)))
    items.push({ id: `INT-${pad(items.length + 1)}`, system: "Customer Consent Management Service", type: "Bidirectional", input: "Customer ID + consent request payload", output: "Consent record (granted/denied) + timestamp", auth: "JWT Bearer", sla: "Consent capture < 2 s", description: "Records and validates customer consent before any bank statement data is fetched. Consent record is stored for regulatory audit." });

  if (frs.some((fr) => /email|notif|alert|message/i.test(fr.description)) && !items.some((i) => /email|notif/i.test(i.system)))
    items.push({ id: `INT-${pad(items.length + 1)}`, system: "Email / Notification Service", type: "Outbound", input: "Event payload + recipient", output: "Delivery receipt", auth: "SMTP / API Key", sla: "Delivery < 5 min; retry 3×", description: "Sends transactional notifications for statement processing completion, manual review routing, and income assessment results." });

  if (frs.some((fr) => /audit|log|track|histor/i.test(fr.description)) && !items.some((i) => /audit/i.test(i.system)))
    items.push({ id: `INT-${pad(items.length + 1)}`, system: "Audit & Compliance Logging Service", type: "Outbound", input: "Structured audit event (JSON)", output: "Immutable log entry", auth: "Internal service token", sla: "Log write < 200 ms", description: "Streams structured audit events for all consent grants, data fetches, income assessments, and manual review decisions. Required for regulatory compliance." });

  if (items.length === 0) {
    items.push({ id: "INT-001", system: "PostgreSQL Database", type: "Internal", input: "SQL queries", output: "Resultset", auth: "Connection pool", sla: "Query < 500 ms", description: "Primary persistent data store for all application entities. Parameterised queries prevent SQL injection." });
    items.push({ id: "INT-002", system: "REST API Gateway", type: "Inbound", input: "HTTP/HTTPS request", output: "JSON response", auth: "JWT Bearer", sla: "P95 < 2 s", description: "HTTP/HTTPS REST interface for frontend-to-backend communication. JWT-authenticated, CORS-configured, rate-limited." });
  }

  return items;
}

// ── NFR → technical spec mapping ─────────────────────────────────────────────
function mapNfrs(nfrs) {
  const specs = nfrs.map((nfr, idx) => ({
    id: `NFR-${pad(idx + 1)}`,
    category: nfr.category,
    requirement: nfr.description,
    metric: deriveMetric(nfr.category),
  }));

  const cats = new Set(nfrs.map((n) => n.category.toLowerCase()));

  if (!cats.has("performance"))
    specs.push({ id: `NFR-${pad(specs.length + 1)}`, category: "Performance", requirement: "System shall respond to standard user interactions within defined SLA targets", metric: "API P95 latency < 2 s; page load < 3 s; DB queries < 500 ms" });
  if (!cats.has("security"))
    specs.push({ id: `NFR-${pad(specs.length + 1)}`, category: "Security", requirement: "All data transmissions shall be encrypted and access strictly controlled", metric: "TLS 1.2+; JWT expiry ≤ 24 h; lockout after 5 failed login attempts" });
  if (!cats.has("availability"))
    specs.push({ id: `NFR-${pad(specs.length + 1)}`, category: "Availability", requirement: "System shall maintain high availability during agreed business hours", metric: "99.5 % uptime SLA; RTO < 4 h; RPO < 1 h; maintenance outside business hours" });

  return specs;
}

function deriveMetric(category) {
  const m = {
    performance:     "P95 response < 2 s; throughput ≥ 100 req/min",
    security:        "Zero critical CVEs; quarterly pen-test; OWASP Top 10 mitigated",
    availability:    "99.5 % uptime; RTO < 4 h; RPO < 1 h",
    scalability:     "Support 3× current peak load without degradation",
    maintainability: "Code coverage ≥ 80 %; deployment cycle < 30 min",
    usability:       "Task completion rate ≥ 90 %; SUS score ≥ 70",
    compatibility:   "Latest 2 versions of major browsers; fully mobile-responsive",
  };
  return m[category.toLowerCase()] ?? "Metrics to be defined per acceptance test plan";
}

// ── Main export ────────────────────────────────────────────────────────────────
export function generateFRD(brd, requestInfo) {
  const meta            = brd.meta;
  const s               = brd.sections;
  const frs             = s.functional_requirements.items;
  const nfrs            = s.non_functional_requirements?.items ?? [];
  const brdIntegrations = s.integration_requirements?.items ?? [];

  const docId    = frdDocId(meta.doc_id);
  const effDate  = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const functionalSpecs = frs.map((fr, idx) => ({
    id:          `FS-${pad(idx + 1)}`,
    brd_ref:     fr.id,
    title:       fr.description.split(" ").slice(0, 9).join(" ") + (fr.description.split(" ").length > 9 ? "…" : ""),
    description: fr.description.match(/^(the system shall |the system |shall |must )/i)
      ? fr.description
      : `The system shall ${fr.description.toLowerCase().replace(/^(must|should|shall|will|the system|system)[ ,]*/i, "").trim()}`,
    priority:            fr.priority,
    acceptance_criteria: deriveAcceptanceCriteria(fr.description, fr.priority),
    business_rules:      deriveBusinessRules(fr.description),
  }));

  const traceMatrix = frs.map((fr, idx) => ({
    brd_ref:     fr.id,
    frd_ref:     `FS-${pad(idx + 1)}`,
    description: fr.description.split(" ").slice(0, 12).join(" ") + "…",
  }));

  return {
    meta: {
      doc_id:          docId,
      brd_doc_id:      meta.doc_id,
      title:           `${meta.title} — Functional Requirements Document`,
      version:         "1.0",
      status:          "Draft",
      category:        meta.category,
      priority:        meta.priority,
      effective_date:  effDate,
      generated_at:    new Date().toISOString(),
      request_number:  requestInfo.req_number ?? "",
      ai_note:         "AI-generated from approved BRD — review and refine with your development team before implementation",
    },
    sections: {
      overview: {
        title: "Document Overview",
        purpose: `This Functional Requirements Document (FRD) provides the detailed functional specifications for implementing "${meta.title}". It is derived from the approved Business Requirements Document (${meta.doc_id}) and gives the technical team actionable specifications to design, build, and validate the solution.`,
        scope:   `This FRD covers: ${s.scope.in_scope.slice(0, 3).join("; ")}. Explicitly excluded: ${s.scope.out_of_scope.slice(0, 2).join("; ")}.`,
        audience: "Software Architects, Developers, QA Engineers, Project Managers, IT Management",
      },
      functional_specifications: {
        title: "Functional Specifications",
        items: functionalSpecs,
      },
      system_behavior: {
        title:     "System Behavior & Workflows",
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
