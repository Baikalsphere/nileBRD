export type PortalRole = "stakeholder" | "ba" | "it";

export type NavItem = {
  label: string;
  href: string;
  icon: string;
};

export const stakeholderNav: NavItem[] = [
  { label: "Dashboard", href: "/stakeholder/dashboard", icon: "layout-dashboard" },
  { label: "Submit Business Problem", href: "/stakeholder/submit-problem", icon: "file-input" },
  { label: "My Requests", href: "/stakeholder/my-requests", icon: "list-checks" },
  { label: "UAT Testing", href: "/stakeholder/uat-testing", icon: "clipboard-check" },
  { label: "AI Assistant", href: "/stakeholder/ai-assistant", icon: "sparkles" },
];

export const baNav: NavItem[] = [
  { label: "Dashboard", href: "/ba/dashboard", icon: "layout-dashboard" },
  { label: "Assigned Requests", href: "/ba/assigned-problems", icon: "briefcase-business" },
  { label: "BRD Management", href: "/ba/brd-management", icon: "file-text" },
  { label: "UAT Oversight", href: "/ba/uat-oversight", icon: "clipboard-check" },
  { label: "User Stories", href: "/ba/user-stories", icon: "book-check" },
  { label: "AI Generator Tools", href: "/ba/ai-tools", icon: "bot" },
];

export const itMemberNav: NavItem[] = [
  { label: "Dashboard", href: "/it-member/dashboard", icon: "layout-dashboard" },
  { label: "Discussions", href: "/it-member/discussions", icon: "message-square" },
  { label: "SIT Testing", href: "/it-member/sit-testing", icon: "flask-conical" },
  { label: "Development Tracking", href: "/it-member/development-tracking", icon: "git-branch" },
  { label: "Deployment", href: "/it-member/deployment", icon: "rocket" },
];

export const itNav: NavItem[] = [
  { label: "Dashboard", href: "/it/dashboard", icon: "layout-dashboard" },
  { label: "Discussions", href: "/it/discussions", icon: "message-square" },
  { label: "Approved BRDs", href: "/it/approved-brds", icon: "file-check-2" },
  { label: "FRD Management", href: "/it/frd-management", icon: "folder-open" },
  { label: "Test Cases", href: "/it/test-cases", icon: "test-tube" },
  { label: "Deployment", href: "/it/deployment", icon: "rocket" },
];

export const stakeholderSummary = [
  { label: "Total Requests", value: 26, delta: "+4 this month" },
  { label: "Pending Approvals", value: 7, delta: "Needs review" },
  { label: "In Progress", value: 11, delta: "Across BA and IT" },
  { label: "Completed", value: 8, delta: "Closed with UAT" },
];

export const baSummary = [
  { label: "Assigned Tasks", value: 18, delta: "6 high priority" },
  { label: "BRDs in Draft", value: 5, delta: "2 awaiting input" },
  { label: "FRDs in Review", value: 3, delta: "Architect review" },
  { label: "Alerts", value: 4, delta: "Due this week" },
];

export const itSummary = [
  { label: "Active Projects", value: 9, delta: "2 near release" },
  { label: "Open Milestones", value: 14, delta: "5 this sprint" },
  { label: "Critical Bugs", value: 3, delta: "Down from 5" },
  { label: "Deployments", value: 12, delta: "Last 30 days" },
];

export const velocityData = [
  { name: "W1", planned: 20, delivered: 18 },
  { name: "W2", planned: 18, delivered: 17 },
  { name: "W3", planned: 22, delivered: 19 },
  { name: "W4", planned: 24, delivered: 23 },
];

export const workflowDistribution = [
  { name: "Submitted", value: 8 },
  { name: "BA Assigned", value: 7 },
  { name: "BRD", value: 5 },
  { name: "FRD", value: 4 },
  { name: "Dev", value: 6 },
  { name: "UAT", value: 3 },
];

export const releaseTimeline = [
  { name: "Jan", value: 2 },
  { name: "Feb", value: 3 },
  { name: "Mar", value: 4 },
  { name: "Apr", value: 3 },
  { name: "May", value: 5 },
];

export const timelineActivity = [
  { id: "1", title: "Problem submitted: Vendor payout mismatch", time: "10:10 AM" },
  { id: "2", title: "BA assigned to payment reconciliation", time: "11:22 AM" },
  { id: "3", title: "BRD draft generated with AI", time: "01:45 PM" },
  { id: "4", title: "IT feasibility notes added", time: "03:09 PM" },
  { id: "5", title: "UAT test run scheduled", time: "04:30 PM" },
];

export type RequestItem = {
  id: string;
  title: string;
  priority: "Low" | "Medium" | "High";
  status: string;
  owner: string;
  stage: "Submitted" | "BA Assigned" | "BRD" | "FRD" | "Dev" | "UAT";
};

export const requests: RequestItem[] = [
  {
    id: "REQ-1021",
    title: "Automate vendor invoice checks",
    priority: "High",
    status: "In Progress",
    owner: "Finance Ops",
    stage: "FRD",
  },
  {
    id: "REQ-1027",
    title: "Improve customer onboarding workflow",
    priority: "Medium",
    status: "Pending",
    owner: "Customer Success",
    stage: "BA Assigned",
  },
  {
    id: "REQ-1033",
    title: "Real-time SLA breach notifications",
    priority: "High",
    status: "Submitted",
    owner: "Service Desk",
    stage: "Submitted",
  },
  {
    id: "REQ-1039",
    title: "Contract renewal forecast dashboard",
    priority: "Low",
    status: "Approved",
    owner: "Legal",
    stage: "Dev",
  },
];

export const approvals = [
  { id: "DOC-11", docType: "BRD", title: "Order Reconciliation BRD", status: "Pending" },
  { id: "DOC-17", docType: "FRD", title: "Portal Alerts FRD", status: "In Progress" },
  { id: "DOC-23", docType: "User Story", title: "Contract SLA story set", status: "Pending" },
];

export const uatCases = [
  { id: "UAT-01", testCase: "Submit request with attachment", result: "Pass" },
  { id: "UAT-02", testCase: "Approve BRD with remarks", result: "Pending" },
  { id: "UAT-03", testCase: "View status timeline", result: "Fail" },
];

export const stakeholderMessages = [
  { from: "Stakeholder", text: "Can we include SLA penalties in the BRD?", at: "09:20" },
  { from: "BA", text: "Yes, adding that in scope and risk section.", at: "09:24" },
  { from: "AI", text: "Insight: SLA penalties require legal review before FRD freeze.", at: "09:27" },
];

export const baProblems = [
  { id: "PRB-33", title: "Delayed payment posting", stakeholder: "Finance", status: "In Progress" },
  { id: "PRB-34", title: "Duplicate customer records", stakeholder: "Sales Ops", status: "Pending" },
  { id: "PRB-35", title: "Manual UAT evidence collation", stakeholder: "QA", status: "Approved" },
];

export const versionHistory = [
  { version: "v1.3", author: "Ananya BA", note: "Added non-functional constraints" },
  { version: "v1.2", author: "Ananya BA", note: "Updated stakeholder matrix" },
  { version: "v1.1", author: "Ananya BA", note: "Initial AI-generated baseline" },
];

export const backlogStories = [
  { id: "US-101", story: "As a stakeholder, I can submit a business problem", priority: "High" },
  { id: "US-103", story: "As a BA, I can generate BRD with AI", priority: "High" },
  { id: "US-108", story: "As IT, I can update SIT status", priority: "Medium" },
];

export const feasibilityRows = [
  {
    item: "Vendor API integration",
    estimate: "$12,000",
    feasibility: "In Progress",
    notes: "Needs API rate-limit confirmation",
  },
  {
    item: "Real-time notification service",
    estimate: "$8,000",
    feasibility: "Approved",
    notes: "Can use existing event bus",
  },
];

export const kanbanColumns = {
  backlog: ["REQ-1027 Define acceptance criteria", "REQ-1033 Clarify alert channels"],
  inProgress: ["REQ-1021 Finalize API schema", "REQ-1039 Add dashboard widgets"],
  done: ["REQ-1015 UAT signoff automation"],
};

export const sitCases = [
  { id: "SIT-11", title: "Role-based navigation permissions", status: "In Progress" },
  { id: "SIT-12", title: "BRD to FRD conversion flow", status: "Pending" },
  { id: "SIT-13", title: "Approval modal workflow", status: "Approved" },
];

export const bugs = [
  { id: "BUG-201", title: "Pagination resets on filter change", severity: "Medium", status: "In Progress" },
  { id: "BUG-204", title: "UAT feedback not retained in local state", severity: "High", status: "Pending" },
  { id: "BUG-211", title: "Discussion timestamps misaligned", severity: "Low", status: "Approved" },
];

export const deployments = [
  { id: "REL-91", env: "Dev", date: "2026-03-10", status: "Completed" },
  { id: "REL-94", env: "SIT", date: "2026-03-14", status: "In Progress" },
  { id: "REL-97", env: "UAT", date: "2026-03-18", status: "Pending" },
  { id: "REL-101", env: "Prod", date: "2026-03-21", status: "Approved" },
];

export const issueLogs = [
  { id: "MON-1", metric: "API latency", value: "184ms", status: "In Progress" },
  { id: "MON-2", metric: "Error rate", value: "0.7%", status: "Approved" },
  { id: "MON-3", metric: "Queue depth", value: "22", status: "Pending" },
];
