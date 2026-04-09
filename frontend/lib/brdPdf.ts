// BRD PDF — Professional document generation
// Shared by BRD Management page and BrdReviewCard in chat

export interface FRItem   { id: string; title?: string; description: string; priority: string; source?: string; original?: string; rationale?: string }
export interface NFRItem  { id: string; category: string; description: string }
export interface RiskItem { id: string; description: string; impact: string; probability: string; mitigation: string }
export interface ActionItem { id: string; description: string; status: string }
export interface Stakeholder { name: string; role: string }
export interface ReadinessCheck { label: string; pass: boolean }
export interface ProcessStep { step: number; actor: string; action: string; outcome: string }
export interface BusinessRule { id: string; description: string }
export interface IntegrationItem { id: string; system: string; type?: string; direction?: string; input?: string; output?: string; auth?: string; sla?: string; description: string }

export interface BrdDoc {
  _db_id?: number;
  _status?: string;
  meta: {
    doc_id: string; version: string; status: string; request_number: string;
    title: string; category: string; priority: string; generated_at: string;
    effective_date: string; ai_models: string[]; source_messages: number;
  };
  sections: {
    executive_summary: { number: string; title: string; text: string };
    objective: { number: string; title: string; text: string; goals: string[] };
    scope: { number: string; title: string; summary?: string; in_scope: string[]; out_of_scope: string[]; process_flow?: ProcessStep[] };
    stakeholders: { number: string; title: string; list: Stakeholder[] };
    functional_requirements: { number: string; title: string; items: FRItem[] };
    non_functional_requirements: { number: string; title: string; items: NFRItem[] };
    business_rules?: { number: string; title: string; items: BusinessRule[] };
    integration_requirements?: { number: string; title: string; items: IntegrationItem[] };
    risk_register: { number: string; title: string; items: RiskItem[] };
    action_items: { number: string; title: string; items: ActionItem[] };
    brd_readiness: { number: string; title: string; checks: ReadinessCheck[]; score: number; readinessLevel: string };
    appendix: { title: string; messages: { sender: string; text: string; marked_at: string }[]; keywords: string[] };
  };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PRIORITY_COLOR: Record<string, string> = {
  "Must Have":   "#be123c", "Should Have": "#b45309",
  "Could Have":  "#0369a1", "Won't Have":  "#475569",
};
const PRIORITY_BG: Record<string, string> = {
  "Must Have":   "#fff1f2", "Should Have": "#fffbeb",
  "Could Have":  "#f0f9ff", "Won't Have":  "#f8fafc",
};
const IMPACT_COLOR: Record<string, { fg: string; bg: string }> = {
  High:   { fg: "#be123c", bg: "#fff1f2" },
  Medium: { fg: "#b45309", bg: "#fffbeb" },
  Low:    { fg: "#15803d", bg: "#f0fdf4" },
};

function priorityPill(p: string) {
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:9pt;font-weight:700;background:${PRIORITY_BG[p] ?? "#f8fafc"};color:${PRIORITY_COLOR[p] ?? "#475569"};border:1px solid ${PRIORITY_COLOR[p] ?? "#e2e8f0"}22;">${esc(p)}</span>`;
}
function impactPill(v: string) {
  const c = IMPACT_COLOR[v] ?? { fg: "#475569", bg: "#f8fafc" };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:9pt;font-weight:700;background:${c.bg};color:${c.fg};">${esc(v)}</span>`;
}
function sectionHeader(num: string, title: string, accent = "#4f46e5") {
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:${accent};color:#fff;font-size:10pt;font-weight:800;flex-shrink:0;">${esc(num)}</div>
      <div style="font-size:13pt;font-weight:700;color:#1e293b;">${esc(title)}</div>
    </div>`;
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --primary: #0f172a; --accent: #4f46e5; --accent2: #7c3aed;
    --muted: #64748b; --border: #e2e8f0; --bg: #f8fafc;
  }
  body { font-family: "Segoe UI", system-ui, Arial, sans-serif; font-size: 10.5pt; color: var(--primary); background: #fff; line-height: 1.65; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 210mm; margin: 0 auto; padding: 0; }
  .content { padding: 28px 36px 40px; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  p { margin-bottom: 8px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  thead tr { background: #1e293b; }
  thead th { color: #fff; text-align: left; padding: 8px 10px; font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 8px 10px; vertical-align: top; line-height: 1.55; }
  .label { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; margin-bottom: 4px; margin-top: 10px; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: #fff; border-left: 4px solid #4f46e5; }
  .card-title { font-size: 10.5pt; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .card-body { font-size: 10pt; color: #334155; line-height: 1.65; }
  .tag { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 8.5pt; font-weight: 600; margin: 1px; }
  ul.bullets { list-style: none; padding: 0; margin: 4px 0; }
  ul.bullets li { padding: 2px 0 2px 14px; position: relative; font-size: 10pt; color: #334155; line-height: 1.55; }
  ul.bullets li::before { content: "•"; position: absolute; left: 0; color: #94a3b8; }
  ul.checks li::before { content: "✓"; color: #16a34a; }
  ul.cross  li::before { content: "✗"; color: #dc2626; }
  .step-row { display: flex; gap: 10px; align-items: flex-start; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .step-num { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: #e0e7ff; color: #4338ca; font-weight: 800; font-size: 9pt; display: flex; align-items: center; justify-content: center; }
  .footer { border-top: 1px solid #e2e8f0; padding: 10px 36px; display: flex; justify-content: space-between; font-size: 8.5pt; color: #94a3b8; margin-top: 32px; }
  .toc-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 5px; font-size: 10pt; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 6px; }
  @media print {
    .no-print { display: none !important; }
    .content { padding: 16px 24px 24px; }
    .page { max-width: 100%; }
    .section { page-break-inside: avoid; }
    .card { page-break-inside: avoid; }
  }
`;

// ─── Cover page ───────────────────────────────────────────────────────────────
function buildBrdCover(meta: BrdDoc["meta"]): string {
  const statusColor = meta.status === "Approved" || meta.status === "Final" ? "#15803d" : meta.status === "In Review" ? "#1d4ed8" : "#b45309";
  const statusBg    = meta.status === "Approved" || meta.status === "Final" ? "#f0fdf4" : meta.status === "In Review" ? "#eff6ff" : "#fffbeb";
  return `
  <!-- Cover -->
  <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);padding:44px 36px 36px;color:#fff;">
    <div style="font-size:9pt;font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:#a5b4fc;margin-bottom:28px;">Business Requirements Document</div>
    <div style="font-size:22pt;font-weight:800;line-height:1.2;margin-bottom:8px;">${esc(meta.title)}</div>
    <div style="font-size:11pt;color:#c7d2fe;margin-bottom:32px;">${esc(meta.category)} &nbsp;·&nbsp; ${esc(meta.priority)} Priority</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      ${[
        ["Document ID",    meta.doc_id],
        ["Version",        `v${meta.version}`],
        ["Status",         meta.status],
        ["Effective Date", meta.effective_date],
        ["Request Ref",    meta.request_number || "—"],
        ["Source Messages",`${meta.source_messages} key points`],
      ].map(([l, v]) => `
        <div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:10px 12px;">
          <div style="font-size:8pt;text-transform:uppercase;letter-spacing:.07em;color:#a5b4fc;margin-bottom:3px;">${l}</div>
          <div style="font-size:11pt;font-weight:700;color:#fff;">${esc(v)}</div>
        </div>`).join("")}
    </div>
  </div>
  <!-- Status bar -->
  <div style="background:#f8fafc;border-bottom:2px solid #e2e8f0;padding:10px 36px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:9pt;color:#64748b;">Prepared by: <b>Business Analyst Portal — BPRM System</b></span>
    <span style="background:${statusBg};color:${statusColor};border:1px solid ${statusColor}33;border-radius:999px;padding:3px 12px;font-size:9pt;font-weight:700;">${esc(meta.status)}</span>
  </div>`;
}

// ─── Table of Contents ────────────────────────────────────────────────────────
function buildTOC(sections: string[]): string {
  return `
  <div class="section" style="margin:20px 0 24px;">
    <div style="font-size:13pt;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;">Table of Contents</div>
    ${sections.map((title, i) => `
      <div class="toc-row">
        <span style="color:#4f46e5;font-weight:600;width:24px;">${i + 1}.</span>
        <span>${esc(title)}</span>
        <span class="toc-dots"></span>
        <span style="color:#94a3b8;font-size:9pt;">${i + 1}</span>
      </div>`).join("")}
  </div>`;
}

export function buildPdfHtml(doc: BrdDoc): string {
  const s    = doc.sections;
  const meta = doc.meta;

  // ── 1. Executive Summary
  const sec1 = `
    <div class="section">
      ${sectionHeader("1", s.executive_summary.title)}
      <p style="font-size:10.5pt;color:#334155;">${esc(s.executive_summary.text)}</p>
    </div>`;

  // ── 2. Business Objective
  const sec2 = `
    <div class="section">
      ${sectionHeader("2", s.objective.title)}
      <p style="font-size:10.5pt;color:#334155;margin-bottom:12px;">${esc(s.objective.text)}</p>
      ${s.objective.goals.length ? `
        <div class="label">Strategic Goals</div>
        <ul class="bullets checks">
          ${s.objective.goals.map(g => `<li>${esc(g)}</li>`).join("")}
        </ul>` : ""}
    </div>`;

  // ── 3. Scope
  const processFlow = s.scope.process_flow ?? [];
  const sec3 = `
    <div class="section">
      ${sectionHeader("3", s.scope.title, "#0284c7")}
      ${s.scope.summary ? `<p style="color:#334155;background:#f0f9ff;border-left:4px solid #0ea5e9;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:14px;">${esc(s.scope.summary)}</p>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:${processFlow.length ? "16px" : "0"};">
        <div>
          <div class="label" style="color:#15803d;">✓ In Scope</div>
          <ul class="bullets checks">${s.scope.in_scope.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        </div>
        <div>
          <div class="label" style="color:#dc2626;">✗ Out of Scope</div>
          <ul class="bullets cross">${s.scope.out_of_scope.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        </div>
      </div>
      ${processFlow.length ? `
        <div class="label" style="color:#4338ca;margin-bottom:8px;">▶ End-to-End Business Process Flow</div>
        <div style="border:1px solid #e0e7ff;border-radius:8px;overflow:hidden;">
          <div style="background:#eef2ff;padding:7px 12px;display:grid;grid-template-columns:28px 70px 1fr 1fr;gap:8px;font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4338ca;">
            <span>#</span><span>Actor</span><span>Action</span><span>Outcome</span>
          </div>
          ${processFlow.map((step, i) => `
            <div style="display:grid;grid-template-columns:28px 70px 1fr 1fr;gap:8px;padding:8px 12px;background:${i % 2 === 0 ? "#fff" : "#fafbff"};border-top:1px solid #e0e7ff;font-size:9.5pt;">
              <span style="width:20px;height:20px;border-radius:50%;background:#4f46e5;color:#fff;font-weight:800;font-size:8pt;display:inline-flex;align-items:center;justify-content:center;">${step.step}</span>
              <span style="color:#4f46e5;font-weight:600;">${esc(step.actor)}</span>
              <span style="color:#334155;">${esc(step.action)}</span>
              <span style="color:#059669;font-size:9pt;">→ ${esc(step.outcome)}</span>
            </div>`).join("")}
        </div>` : ""}
    </div>`;

  // ── 4. Stakeholders
  const sec4 = `
    <div class="section">
      ${sectionHeader("4", s.stakeholders.title, "#0891b2")}
      <table>
        <thead><tr><th style="width:35%;">Name</th><th>Role / Responsibility</th></tr></thead>
        <tbody>${s.stakeholders.list.map(st => `
          <tr>
            <td style="font-weight:600;">${esc(st.name)}</td>
            <td style="color:#475569;">${esc(st.role)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  // ── 5. Functional Requirements
  const sec5 = `
    <div class="section">
      ${sectionHeader("5", s.functional_requirements.title, "#059669")}
      ${s.functional_requirements.items.length ? s.functional_requirements.items.map(fr => `
        <div class="card" style="border-left-color:${PRIORITY_COLOR[fr.priority] ?? "#4f46e5"};">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:12px;">
            <div style="flex:1;">
              <span style="font-family:monospace;font-size:9.5pt;font-weight:800;color:#4338ca;">${esc(fr.id)}</span>
              ${fr.title ? `<span style="font-size:10.5pt;font-weight:700;color:#1e293b;margin-left:8px;">${esc(fr.title)}</span>` : ""}
            </div>
            ${priorityPill(fr.priority)}
          </div>
          <div class="card-body" style="margin-bottom:${fr.rationale ? "8px" : "0"};">${esc(fr.description)}</div>
          ${fr.rationale ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:6px 10px;border-radius:0 6px 6px 0;font-size:9.5pt;color:#92400e;margin-top:6px;"><b>Rationale:</b> ${esc(fr.rationale)}</div>` : ""}
        </div>`).join("") : `<p style="color:#94a3b8;font-style:italic;">No functional requirements extracted.</p>`}
    </div>`;

  // ── 6. Non-Functional Requirements
  const sec6 = s.non_functional_requirements.items.length ? `
    <div class="section">
      ${sectionHeader("6", s.non_functional_requirements.title, "#7c3aed")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${s.non_functional_requirements.items.map(n => `
          <div style="border:1px solid #ede9fe;border-radius:8px;padding:10px 12px;background:#faf5ff;">
            <div style="font-size:9pt;font-weight:700;color:#7c3aed;margin-bottom:4px;">${esc(n.id)} &nbsp;·&nbsp; ${esc(n.category)}</div>
            <div style="font-size:9.5pt;color:#334155;line-height:1.55;">${esc(n.description)}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

  // ── 7. Business Rules
  const br = (doc.sections as any).business_rules;
  const sec7 = br?.items?.length ? `
    <div class="section">
      ${sectionHeader("7", br.title, "#7c3aed")}
      ${br.items.map((rule: BusinessRule) => `
        <div style="display:flex;gap:10px;align-items:flex-start;padding:7px 10px;border-radius:6px;margin-bottom:6px;background:#fdf4ff;border:1px solid #e9d5ff;">
          <span style="font-family:monospace;font-size:9pt;font-weight:800;color:#7c3aed;flex-shrink:0;min-width:48px;">${esc(rule.id)}</span>
          <span style="font-size:10pt;color:#1e293b;line-height:1.6;">${esc(rule.description)}</span>
        </div>`).join("")}
    </div>` : "";

  // ── 8. Integration Requirements
  const ir = (doc.sections as any).integration_requirements;
  const sec8 = ir?.items?.length ? `
    <div class="section">
      ${sectionHeader("8", ir.title, "#0284c7")}
      ${ir.items.map((item: IntegrationItem) => `
        <div class="card" style="border-left-color:#0284c7;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
            <span style="font-family:monospace;font-weight:800;color:#0284c7;font-size:9.5pt;">${esc(item.id)}</span>
            <span style="font-weight:700;color:#1e293b;">${esc(item.system)}</span>
            <span style="background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 7px;font-size:8.5pt;font-weight:600;">${esc(item.direction ?? item.type ?? "")}</span>
          </div>
          <div class="card-body" style="margin-bottom:8px;">${esc(item.description)}</div>
          ${(item.input || item.output || item.auth || item.sla) ? `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border-top:1px solid #e0f2fe;padding-top:8px;margin-top:4px;">
              ${item.input  ? `<div><div class="label">Input</div><div style="font-size:9pt;color:#334155;">${esc(item.input)}</div></div>`  : ""}
              ${item.output ? `<div><div class="label">Output</div><div style="font-size:9pt;color:#334155;">${esc(item.output)}</div></div>` : ""}
              ${item.auth   ? `<div><div class="label">Auth</div><div style="font-size:9pt;color:#334155;">${esc(item.auth)}</div></div>`    : ""}
              ${item.sla    ? `<div><div class="label">SLA</div><div style="font-size:9pt;font-weight:700;color:#059669;">${esc(item.sla)}</div></div>` : ""}
            </div>` : ""}
        </div>`).join("")}
    </div>` : "";

  // ── 9. Risk Register
  const sec9 = s.risk_register.items.length ? `
    <div class="section">
      ${sectionHeader("9", s.risk_register.title, "#dc2626")}
      <table>
        <thead><tr><th style="width:56px;">ID</th><th>Risk Description</th><th style="width:72px;">Impact</th><th style="width:80px;">Probability</th><th>Mitigation Strategy</th></tr></thead>
        <tbody>${s.risk_register.items.map(r => `
          <tr>
            <td><span style="font-family:monospace;font-weight:700;color:#dc2626;">${esc(r.id)}</span></td>
            <td>${esc(r.description)}</td>
            <td>${impactPill(r.impact)}</td>
            <td>${impactPill(r.probability)}</td>
            <td style="font-size:9.5pt;color:#475569;">${esc(r.mitigation)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  // ── 10. Action Items
  const sec10 = s.action_items.items.length ? `
    <div class="section">
      ${sectionHeader("10", s.action_items.title, "#0891b2")}
      <table>
        <thead><tr><th style="width:56px;">ID</th><th>Action</th><th style="width:80px;">Status</th></tr></thead>
        <tbody>${s.action_items.items.map(a => `
          <tr>
            <td><span style="font-family:monospace;font-weight:700;color:#0891b2;">${esc(a.id)}</span></td>
            <td>${esc(a.description)}</td>
            <td><span style="background:#fef3c7;color:#b45309;border-radius:999px;padding:2px 8px;font-size:8.5pt;font-weight:700;">${esc(a.status)}</span></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  // ── 11. Readiness
  const score = s.brd_readiness.score;
  const scoreColor = score >= 5 ? "#15803d" : score >= 3 ? "#d97706" : "#dc2626";
  const sec11 = `
    <div class="section">
      ${sectionHeader("11", s.brd_readiness.title, "#059669")}
      <div style="display:flex;gap:24px;align-items:flex-start;">
        <div style="text-align:center;background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:20px 28px;flex-shrink:0;">
          <div style="font-size:36pt;font-weight:900;color:${scoreColor};line-height:1;">${score}/5</div>
          <div style="font-size:9pt;color:#64748b;font-weight:600;margin-top:4px;">Readiness Score</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:11pt;font-weight:700;color:${scoreColor};margin-bottom:10px;">${esc(s.brd_readiness.readinessLevel)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            ${(s.brd_readiness.checks || []).map(c => `
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:12pt;color:${c.pass ? "#16a34a" : "#94a3b8"};">${c.pass ? "✓" : "✗"}</span>
                <span style="font-size:10pt;color:${c.pass ? "#1e293b" : "#94a3b8"};">${esc(c.label)}</span>
              </div>`).join("")}
          </div>
        </div>
      </div>
    </div>`;

  // ── Appendix
  const keywords = (s.appendix.keywords || []).map(k =>
    `<span style="background:#f3e8ff;color:#7c3aed;padding:3px 10px;border-radius:999px;font-size:9pt;font-weight:600;margin:2px;display:inline-block;">${esc(k)}</span>`
  ).join("");

  const sourceMessages = (s.appendix.messages || []).slice(0, 10).map(m => `
    <div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:6px;padding:10px 12px;margin-bottom:8px;">
      <div style="font-size:10pt;color:#334155;line-height:1.6;margin-bottom:4px;">"${esc(m.text)}"</div>
      <div style="font-size:9pt;font-weight:600;color:#94a3b8;">${esc(m.sender)} &nbsp;·&nbsp; ${new Date(m.marked_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
    </div>`).join("");

  const secAppendix = `
    <div class="section">
      ${sectionHeader("A", "Appendix: Key Conversation Excerpts", "#64748b")}
      ${keywords ? `<div class="label" style="margin-bottom:6px;">Key Topics Identified</div><div style="margin-bottom:14px;">${keywords}</div>` : ""}
      <div class="label" style="margin-bottom:8px;">Source Conversations (${s.appendix.messages.length} marked)</div>
      ${sourceMessages}
    </div>`;

  const tocTitles = [
    s.executive_summary.title,
    s.objective.title,
    s.scope.title,
    s.stakeholders.title,
    s.functional_requirements.title,
    s.non_functional_requirements.title,
    ...(br?.items?.length ? [br.title] : []),
    ...(ir?.items?.length ? [ir.title] : []),
    s.risk_register.title,
    s.action_items.title,
    s.brd_readiness.title,
    "Appendix",
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(meta.doc_id)} — ${esc(meta.title)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="page">
  <!-- Toolbar (hidden on print) -->
  <div class="no-print" style="position:sticky;top:0;z-index:999;background:#1e293b;padding:10px 36px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:10pt;font-weight:600;color:#94a3b8;">${esc(meta.doc_id)} &nbsp;·&nbsp; <em style="color:#e2e8f0;">${esc(meta.title)}</em></span>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;border-radius:7px;padding:8px 20px;font-size:10pt;font-weight:700;cursor:pointer;">⬇ Save as PDF</button>
      <button onclick="window.close()" style="background:#374151;color:#9ca3af;border:none;border-radius:7px;padding:8px 14px;font-size:10pt;cursor:pointer;">✕</button>
    </div>
  </div>

  ${buildBrdCover(meta)}

  <div class="content">
    ${buildTOC(tocTitles)}
    ${sec1}${sec2}${sec3}${sec4}${sec5}${sec6}${sec7}${sec8}${sec9}${sec10}${sec11}${secAppendix}
  </div>

  <div class="footer">
    <span>${esc(meta.doc_id)} — v${esc(meta.version)} &nbsp;|&nbsp; CONFIDENTIAL — INTERNAL USE</span>
    <span>Generated ${new Date(meta.generated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
    <span>${esc(meta.ai_models?.[0] ?? "")}</span>
  </div>
</div>
</body>
</html>`;
}

export function openPdf(doc: BrdDoc) {
  const win = window.open("", "_blank");
  if (!win) { alert("Allow popups for this site to open the BRD PDF."); return; }
  win.document.write(buildPdfHtml(doc));
  win.document.close();
}
