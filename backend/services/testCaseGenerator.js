/**
 * Test Case Generator — Converts a structured FRD JSON into a comprehensive
 * set of test cases covering System, Integration, UAT, Performance, and Security.
 *
 * Fully deterministic — no ML model required.
 *
 * Test types produced per FRD:
 *  - System tests   : happy path + negative for every Functional Specification
 *  - UAT tests      : business rule validation (up to 4)
 *  - Integration    : one per integration requirement (up to 3)
 *  - Performance    : load & response time test (if NFR present)
 *  - Security       : auth + injection + encryption test (always included)
 */

function pad(n, len = 3) {
  return String(n).padStart(len, "0");
}

function tcId(idx) {
  return `TC-${pad(idx + 1)}`;
}

const PRIORITY_MAP = {
  "Must Have":   "Critical",
  "Should Have": "High",
  "Could Have":  "Medium",
  "Won't Have":  "Low",
};

function frdPriorityToTcPriority(p) {
  return PRIORITY_MAP[p] ?? "Medium";
}

// ── System test cases from a single FS ────────────────────────────────────────
function systemTestsFromFs(fs, startIdx) {
  const priority = frdPriorityToTcPriority(fs.priority);
  const cases = [];

  // Happy path
  cases.push({
    id:          tcId(startIdx),
    frd_ref:     fs.id,
    name:        `${fs.id} — Happy Path: ${fs.title}`,
    description: `Verify the system correctly implements the functional specification: "${fs.description}"`,
    type:        "System",
    priority,
    preconditions: [
      "User is authenticated and has the appropriate role and permissions",
      "System environment is operational with representative test data loaded",
      "All dependent services and integrations are available",
    ],
    steps: [
      { step_num: 1, action: "Authenticate with valid credentials for the target role",                     expected: "User is logged in and directed to the home dashboard" },
      { step_num: 2, action: "Navigate to the module or feature area relevant to this specification",       expected: "Feature area loads correctly without errors or warnings" },
      { step_num: 3, action: "Execute the primary action as described in the functional specification",     expected: fs.description },
      { step_num: 4, action: "Verify the system state and data persistence after the action",               expected: "System confirms the action; data is saved correctly; UI reflects the updated state" },
      { step_num: 5, action: `Validate acceptance criterion: "${fs.acceptance_criteria[0] ?? "System behaves as specified"}"`, expected: "Acceptance criterion is fully met" },
    ],
    expected_result: `System successfully executes the specification. ${fs.acceptance_criteria[0] ?? ""}`,
    status: "Pending",
  });

  // Negative / edge case for high-priority requirements
  if (["Must Have", "Should Have"].includes(fs.priority)) {
    cases.push({
      id:          tcId(startIdx + 1),
      frd_ref:     fs.id,
      name:        `${fs.id} — Negative: Invalid Input & Boundary Handling`,
      description: `Verify the system gracefully handles invalid, missing, or boundary inputs for: "${fs.title}"`,
      type:        "System",
      priority:    priority === "Critical" ? "High" : "Medium",
      preconditions: [
        "User is authenticated with appropriate permissions",
        "System is in a known stable state",
      ],
      steps: [
        { step_num: 1, action: "Navigate to the feature area for this specification",                           expected: "Feature loads correctly" },
        { step_num: 2, action: "Attempt to perform the action with missing required fields",                    expected: "System displays a validation error and does not process the request" },
        { step_num: 3, action: "Attempt to perform the action with invalid data types or out-of-range values",  expected: "System rejects the input with a clear, user-friendly error message" },
        { step_num: 4, action: "Confirm the database has not been corrupted by the invalid attempts",           expected: "Database remains in its prior consistent state; no partial records created" },
        { step_num: 5, action: "Correct all inputs and resubmit",                                               expected: "System processes the valid request successfully" },
      ],
      expected_result: "System handles all invalid inputs gracefully with appropriate messages and maintains full data integrity",
      status: "Pending",
    });
  }

  return cases;
}

// ── UAT test cases ─────────────────────────────────────────────────────────────
function uatTestCases(sections, startIdx) {
  const cases = [];
  const fsItems = sections.functional_specifications.items;

  fsItems
    .filter((fs) => fs.business_rules.length > 0)
    .slice(0, 4)
    .forEach((fs, i) => {
      cases.push({
        id:          tcId(startIdx + i),
        frd_ref:     fs.id,
        name:        `UAT — Business Rule Validation: ${fs.id}`,
        description: `User acceptance test confirming business rules for "${fs.title}"`,
        type:        "UAT",
        priority:    frdPriorityToTcPriority(fs.priority),
        preconditions: [
          "Business stakeholder representative is present and available",
          "UAT environment contains production-equivalent data",
          "System is fully deployed to the UAT environment",
        ],
        steps: [
          { step_num: 1, action: "Stakeholder walks through the expected business workflow end-to-end",          expected: "Workflow is fully supported by the system as described" },
          { step_num: 2, action: `Validate business rule: "${fs.business_rules[0]}"`,                           expected: "Business rule is correctly enforced by the system" },
          { step_num: 3, action: fs.business_rules[1] ? `Validate additional rule: "${fs.business_rules[1]}"` : "Verify that output data matches business expectations", expected: "System output matches stakeholder's business requirements" },
          { step_num: 4, action: "Test edge cases and exception scenarios identified by the stakeholder",        expected: "All identified edge cases are handled appropriately" },
          { step_num: 5, action: "Stakeholder signs off on the scenario",                                        expected: "Sign-off recorded; test case marked as accepted" },
        ],
        expected_result: `Stakeholder accepts the implementation as meeting all business rules for "${fs.title}"`,
        status: "Pending",
      });
    });

  return cases;
}

// ── Integration test cases ─────────────────────────────────────────────────────
function integrationTestCases(sections, startIdx) {
  const cases = [];
  const intItems = sections.integration_requirements.items;

  intItems.slice(0, 3).forEach((int, i) => {
    cases.push({
      id:          tcId(startIdx + i),
      frd_ref:     int.id,
      name:        `Integration — ${int.system}: ${int.type} Channel`,
      description: `Verify ${int.type.toLowerCase()} integration with ${int.system} as specified in ${int.id}`,
      type:        "Integration",
      priority:    "High",
      preconditions: [
        `${int.system} is available and correctly configured in the test environment`,
        "Integration credentials, endpoints, and certificates are provisioned",
        "Test data for integration scenarios is prepared",
      ],
      steps: [
        { step_num: 1, action: `Trigger a system event that requires communication with ${int.system}`,      expected: "System initiates the integration call" },
        { step_num: 2, action: "Capture and inspect the outbound request payload",                           expected: "Payload is correctly structured and conforms to the integration contract" },
        { step_num: 3, action: "Verify the system correctly processes the integration response",             expected: "Response is parsed accurately; system state is updated appropriately" },
        { step_num: 4, action: `Simulate a failure response from ${int.system}`,                            expected: "System handles the failure gracefully with logging and appropriate user feedback" },
        { step_num: 5, action: "Verify retry logic and timeout behaviour",                                   expected: "System retries per the configured policy and escalates if all retries fail" },
      ],
      expected_result: `${int.system} integration functions correctly for ${int.type.toLowerCase()} communication. Failure scenarios are handled gracefully.`,
      status: "Pending",
    });
  });

  return cases;
}

// ── Performance test case ──────────────────────────────────────────────────────
function performanceTestCase(sections, startIdx) {
  const nfr = sections.non_functional_requirements.items.find((n) => /performance/i.test(n.category));
  if (!nfr) return [];

  return [
    {
      id:          tcId(startIdx),
      frd_ref:     nfr.id,
      name:        "Performance — Load, Throughput & Response Time",
      description: `Verify the system meets performance requirements: ${nfr.metric}`,
      type:        "System",
      priority:    "High",
      preconditions: [
        "Performance test tooling is configured (e.g. k6, JMeter, Locust)",
        "Test environment mirrors production infrastructure (same instance types)",
        "Baseline performance metrics have been captured in a previous run",
      ],
      steps: [
        { step_num: 1, action: "Execute baseline load test with 10 concurrent virtual users for 5 minutes",          expected: "All requests complete; P95 response < 2 s; error rate = 0 %" },
        { step_num: 2, action: "Ramp to 50 concurrent users and sustain for 10 minutes",                             expected: "Response times remain within SLA; error rate < 0.1 %" },
        { step_num: 3, action: "Execute stress test at 3× the expected peak load",                                    expected: "System degrades gracefully; critical functions remain available; no data corruption" },
        { step_num: 4, action: "Reduce load back to baseline and observe recovery",                                   expected: "Response times return to baseline within 60 seconds of load reduction" },
        { step_num: 5, action: "Compare results against performance targets in the NFR",                              expected: `All targets met: ${nfr.metric}` },
      ],
      expected_result: `System meets or exceeds all performance targets: ${nfr.metric}`,
      status: "Pending",
    },
  ];
}

// ── Security test case ─────────────────────────────────────────────────────────
function securityTestCase(sections, startIdx) {
  const nfr = sections.non_functional_requirements.items.find((n) => /security/i.test(n.category));
  const metric = nfr?.metric ?? "TLS 1.2+; JWT expiry ≤ 24 h; lockout after 5 attempts";

  return [
    {
      id:          tcId(startIdx),
      frd_ref:     nfr?.id ?? "NFR-SEC",
      name:        "Security — Authentication, Authorisation & Data Protection",
      description: "Verify all security controls: authentication, authorisation, injection prevention, and encryption",
      type:        "System",
      priority:    "Critical",
      preconditions: [
        "Test accounts with each defined role are provisioned",
        "System is deployed in an isolated security test environment",
        "OWASP ZAP or equivalent security scanning tool is available",
      ],
      steps: [
        { step_num: 1, action: "Attempt to access protected API endpoints without a token",                   expected: "System returns 401 Unauthorised; no data is exposed" },
        { step_num: 2, action: "Attempt cross-role access (e.g. stakeholder accessing BA-only resources)",    expected: "System returns 403 Forbidden; access is denied and logged" },
        { step_num: 3, action: "Submit an expired or tampered JWT and attempt access",                        expected: "Token is rejected; user is prompted to re-authenticate" },
        { step_num: 4, action: "Test all input fields for SQL injection, XSS, and command injection payloads", expected: "All injections are blocked; inputs are sanitised; no error details leaked" },
        { step_num: 5, action: "Verify all data in transit uses HTTPS/TLS",                                   expected: "No plain-text HTTP traffic; certificate is valid and not expired" },
        { step_num: 6, action: "Trigger account lockout by submitting 5+ invalid login attempts",              expected: "Account is locked after threshold; admin receives alert" },
      ],
      expected_result: `All security controls function correctly. No critical vulnerabilities. Targets met: ${metric}`,
      status: "Pending",
    },
  ];
}

// ── Main export ────────────────────────────────────────────────────────────────
export function generateTestCases(frd, requestInfo) {
  const s   = frd.sections;
  const all = [];
  let idx   = 0;

  // System tests — one happy path per FS, plus negative for Must Have / Should Have
  for (const fs of s.functional_specifications.items) {
    const batch = systemTestsFromFs(fs, idx);
    all.push(...batch);
    idx += batch.length;
  }

  // UAT tests
  const uat = uatTestCases(s, idx);
  all.push(...uat);
  idx += uat.length;

  // Integration tests
  const intTests = integrationTestCases(s, idx);
  all.push(...intTests);
  idx += intTests.length;

  // Performance test
  const perf = performanceTestCase(s, idx);
  all.push(...perf);
  idx += perf.length;

  // Security test
  const sec = securityTestCase(s, idx);
  all.push(...sec);

  const summary = {
    total:       all.length,
    system:      all.filter((tc) => tc.type === "System").length,
    integration: all.filter((tc) => tc.type === "Integration").length,
    uat:         all.filter((tc) => tc.type === "UAT").length,
    critical:    all.filter((tc) => tc.priority === "Critical").length,
    high:        all.filter((tc) => tc.priority === "High").length,
    medium:      all.filter((tc) => tc.priority === "Medium").length,
    low:         all.filter((tc) => tc.priority === "Low").length,
  };

  return {
    meta: {
      doc_id:          `TC-${frd.meta.doc_id.replace(/^FRD-/, "")}`,
      frd_doc_id:      frd.meta.doc_id,
      brd_doc_id:      frd.meta.brd_doc_id,
      title:           `${frd.meta.title.replace(" — Functional Requirements Document", "")} — Test Cases`,
      version:         "1.0",
      status:          "Draft",
      generated_at:    new Date().toISOString(),
      request_number:  requestInfo.req_number ?? "",
      total_cases:     all.length,
      summary,
    },
    test_cases: all,
  };
}
