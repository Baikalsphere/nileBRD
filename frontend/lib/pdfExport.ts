/**
 * PDF Export — FRD & Test Cases
 * Professional document generation matching brdPdf.ts design system.
 * Uses window.print() → browser "Save as PDF" (zero dependencies, vector output).
 */

// ─── Shared helpers ───────────────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --primary: #0f172a; --accent: #4f46e5; --accent2: #7c3aed; --muted: #64748b; --border: #e2e8f0; }
  body { font-family: "Segoe UI", system-ui, Arial, sans-serif; font-size: 10.5pt; color: var(--primary); background: #fff; line-height: 1.65; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 210mm; margin: 0 auto; }
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
  .toc-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 5px; font-size: 10pt; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 6px; }
  .footer { border-top: 1px solid #e2e8f0; padding: 10px 36px; display: flex; justify-content: space-between; font-size: 8.5pt; color: #94a3b8; margin-top: 32px; }
  .stat-box { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); border-radius: 8px; padding: 10px 12px; }
  .stat-label { font-size: 8pt; text-transform: uppercase; letter-spacing: .07em; color: #a5b4fc; margin-bottom: 3px; }
  .stat-value { font-size: 13pt; font-weight: 800; color: #fff; }
  @media print {
    .no-print { display: none !important; }
    .content { padding: 16px 24px 24px; }
    .page { max-width: 100%; }
    .section { page-break-inside: avoid; }
    .card { page-break-inside: avoid; }
  }
`;

function sectionHeader(num: string, title: string, accent = "#4f46e5"): string {
  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:${accent};color:#fff;font-size:10pt;font-weight:800;flex-shrink:0;">${esc(num)}</div>
      <div style="font-size:13pt;font-weight:700;color:#1e293b;">${esc(title)}</div>
    </div>`;
}

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

function darkToolbar(docId: string, title: string): string {
  return `
  <div class="no-print" style="position:sticky;top:0;z-index:999;background:#1e293b;padding:10px 36px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:10pt;font-weight:600;color:#94a3b8;">${esc(docId)} &nbsp;·&nbsp; <em style="color:#e2e8f0;">${esc(title)}</em></span>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;border-radius:7px;padding:8px 20px;font-size:10pt;font-weight:700;cursor:pointer;">⬇ Save as PDF</button>
      <button onclick="window.close()" style="background:#374151;color:#9ca3af;border:none;border-radius:7px;padding:8px 14px;font-size:10pt;cursor:pointer;">✕</button>
    </div>
  </div>`;
}

function priorityPill(p: string): string {
  const COLOR: Record<string, string> = { "Must Have": "#be123c", "Should Have": "#b45309", "Could Have": "#0369a1", "Won't Have": "#475569" };
  const BG:    Record<string, string> = { "Must Have": "#fff1f2", "Should Have": "#fffbeb", "Could Have": "#f0f9ff", "Won't Have": "#f8fafc" };
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:9pt;font-weight:700;background:${BG[p] ?? "#f8fafc"};color:${COLOR[p] ?? "#475569"};border:1px solid ${COLOR[p] ?? "#e2e8f0"}22;">${esc(p)}</span>`;
}

function badge(text: string, bg: string, fg: string): string {
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:8.5pt;font-weight:700;background:${bg};color:${fg};">${esc(text)}</span>`;
}

function openPrintWindow(html: string): void {
  const win = window.open("", "_blank");
  if (!win) { alert("Please allow pop-ups to download PDFs."); return; }
  win.document.write(html);
  win.document.close();
}

// ─── FRD Types ────────────────────────────────────────────────────────────────
interface FsItem { id: string; brd_ref: string; title: string; description: string; priority: string; acceptance_criteria: string[]; business_rules: string[] }
interface WorkflowItem { id: string; name: string; trigger: string; steps: string[]; expected_outcome: string }
interface EntityItem { name: string; attributes: string[]; constraints: string[] }
interface ScreenItem { name: string; description: string; components: string[] }
interface IntItem { id: string; system: string; type: string; description: string }
interface NfrItem { id: string; category: string; requirement: string; metric: string }
interface TraceItem { brd_ref: string; frd_ref: string; description: string }

interface FrdDoc {
  meta: {
    doc_id: string; brd_doc_id: string; title: string; version: string;
    status: string; category: string; priority: string; effective_date: string;
    generated_at: string; request_number: string; ai_note: string;
  };
  sections: {
    overview: { title: string; purpose: string; scope: string; audience: string };
    functional_specifications: { title: string; items: FsItem[] };
    system_behavior: { title: string; workflows: WorkflowItem[] };
    data_requirements: { title: string; entities: EntityItem[] };
    ui_requirements: { title: string; screens: ScreenItem[] };
    integration_requirements: { title: string; items: IntItem[] };
    non_functional_requirements: { title: string; items: NfrItem[] };
    traceability_matrix: { title: string; mappings: TraceItem[] };
  };
}

// ─── FRD Cover ────────────────────────────────────────────────────────────────
function buildFrdCover(m: FrdDoc["meta"]): string {
  const statusColor = m.status === "Approved" || m.status === "Final" ? "#15803d" : m.status === "In Review" ? "#1d4ed8" : "#b45309";
  const statusBg    = m.status === "Approved" || m.status === "Final" ? "#f0fdf4" : m.status === "In Review" ? "#eff6ff" : "#fffbeb";
  const gridItems: [string, string][] = [
    ["Document ID",    m.doc_id],
    ["BRD Reference",  m.brd_doc_id],
    ["Version",        `v${m.version}`],
    ["Status",         m.status],
    ["Effective Date", m.effective_date],
    ["Request Ref",    m.request_number || "—"],
  ];
  return `
  <div style="background:linear-gradient(135deg,#1e1b4b 0%,#4c1d95 50%,#6d28d9 100%);padding:44px 36px 36px;color:#fff;">
    <div style="font-size:9pt;font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:#c4b5fd;margin-bottom:28px;">Functional Requirements Document</div>
    <div style="font-size:22pt;font-weight:800;line-height:1.2;margin-bottom:8px;">${esc(m.title)}</div>
    <div style="font-size:11pt;color:#ddd6fe;margin-bottom:32px;">${esc(m.category)} &nbsp;·&nbsp; ${esc(m.priority)} Priority</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      ${gridItems.map(([l, v]) => `
        <div class="stat-box">
          <div class="stat-label">${l}</div>
          <div class="stat-value" style="font-size:11pt;">${esc(v)}</div>
        </div>`).join("")}
    </div>
  </div>
  <div style="background:#f8fafc;border-bottom:2px solid #e2e8f0;padding:10px 36px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:9pt;color:#64748b;">Prepared by: <b>Business Analyst Portal — BPRM System</b></span>
    <span style="background:${statusBg};color:${statusColor};border:1px solid ${statusColor}33;border-radius:999px;padding:3px 12px;font-size:9pt;font-weight:700;">${esc(m.status)}</span>
  </div>`;
}

// ─── FRD PDF ─────────────────────────────────────────────────────────────────
export function downloadFRDAsPDF(doc: FrdDoc) {
  const m = doc.meta;
  const s = doc.sections;

  const PRIORITY_BORDER: Record<string, string> = {
    "Must Have": "#be123c", "Should Have": "#b45309", "Could Have": "#0369a1",
  };

  // AI Note
  const aiNote = m.ai_note ? `
    <div style="border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:9.5pt;color:#92400e;">
      <b>⚠ AI-Generated Document:</b> ${esc(m.ai_note)}
    </div>` : "";

  // Section 1 — Overview
  const sec1 = `
    <div class="section">
      ${sectionHeader("1", s.overview.title, "#0891b2")}
      <div class="label">Purpose</div>
      <p>${esc(s.overview.purpose)}</p>
      <div class="label">Scope</div>
      <p>${esc(s.overview.scope)}</p>
      <div class="label">Intended Audience</div>
      <p>${esc(s.overview.audience)}</p>
    </div>`;

  // Section 2 — Functional Specifications
  const sec2 = `
    <div class="section">
      ${sectionHeader("2", s.functional_specifications.title, "#059669")}
      ${s.functional_specifications.items.map(fs => {
        const borderColor = PRIORITY_BORDER[fs.priority] ?? "#4f46e5";
        // Split AC lines into Given/When/Then for visual grouping
        const acItems = fs.acceptance_criteria.slice(0, 5).map(c => `<li>${esc(c)}</li>`).join("");
        const brItems = fs.business_rules.slice(0, 3).map(r => `<li>${esc(r)}</li>`).join("");
        return `
        <div class="card" style="border-left-color:${borderColor};margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:12px;">
            <div style="flex:1;">
              <span style="font-family:monospace;font-size:9.5pt;font-weight:800;color:#4338ca;">${esc(fs.id)}</span>
              <span style="font-size:8.5pt;color:#94a3b8;margin-left:8px;">← ${esc(fs.brd_ref)}</span>
              <div class="card-title" style="margin-top:4px;">${esc(fs.title)}</div>
            </div>
            ${priorityPill(fs.priority)}
          </div>
          <div class="card-body" style="margin-bottom:10px;">${esc(fs.description)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border-top:1px solid #f1f5f9;padding-top:10px;">
            <div>
              <div class="label" style="color:#059669;">✓ Acceptance Criteria</div>
              <ul class="bullets" style="margin-top:4px;">${acItems}</ul>
            </div>
            <div>
              <div class="label" style="color:#7c3aed;">⚡ Business Rules</div>
              <ul class="bullets" style="margin-top:4px;">${brItems || "<li style='color:#94a3b8;font-style:italic;'>None specified</li>"}</ul>
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>`;

  // Section 3 — System Behavior / Workflows
  const sec3 = `
    <div class="section">
      ${sectionHeader("3", s.system_behavior.title, "#4f46e5")}
      ${s.system_behavior.workflows.map(wf => `
        <div class="card" style="border-left-color:#4f46e5;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-family:monospace;font-weight:800;color:#4338ca;font-size:9.5pt;">${esc(wf.id)}</span>
            <span class="card-title">${esc(wf.name)}</span>
          </div>
          <div style="background:#f0f9ff;border-left:3px solid #0ea5e9;padding:7px 12px;border-radius:0 6px 6px 0;font-size:9.5pt;margin-bottom:10px;color:#0c4a6e;">
            <b>Trigger:</b> ${esc(wf.trigger)}
          </div>
          <div class="label" style="margin-bottom:6px;color:#4338ca;">Process Steps</div>
          ${wf.steps.map((step, i) => `
            <div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;border-bottom:1px solid #f1f5f9;">
              <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#e0e7ff;color:#4338ca;font-weight:800;font-size:8.5pt;display:inline-flex;align-items:center;justify-content:center;">${i + 1}</span>
              <span style="font-size:9.5pt;color:#334155;line-height:1.55;">${esc(step)}</span>
            </div>`).join("")}
          <div style="margin-top:10px;padding:7px 12px;background:#f0fdf4;border-radius:6px;font-size:9.5pt;color:#15803d;">
            <b>Expected Outcome:</b> ${esc(wf.expected_outcome)}
          </div>
        </div>`).join("")}
    </div>`;

  // Section 4 — Data Requirements
  const sec4 = `
    <div class="section">
      ${sectionHeader("4", s.data_requirements.title, "#0284c7")}
      <table>
        <thead><tr><th style="width:22%;">Entity</th><th>Key Attributes</th><th>Constraints</th></tr></thead>
        <tbody>${s.data_requirements.entities.map(e => `
          <tr>
            <td><b>${esc(e.name)}</b></td>
            <td>${e.attributes.slice(0, 6).map(a => `<span style="background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 6px;font-size:8.5pt;margin:1px;display:inline-block;font-family:monospace;">${esc(a)}</span>`).join(" ")}</td>
            <td><ul class="bullets">${e.constraints.slice(0, 3).map(c => `<li>${esc(c)}</li>`).join("")}</ul></td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  // Section 5 — UI Requirements
  const sec5 = `
    <div class="section">
      ${sectionHeader("5", s.ui_requirements.title, "#0891b2")}
      ${s.ui_requirements.screens.map(sc => `
        <div class="card" style="border-left-color:#0891b2;margin-bottom:10px;">
          <div class="card-title">${esc(sc.name)}</div>
          <div class="card-body" style="margin-bottom:8px;">${esc(sc.description)}</div>
          <div class="label" style="margin-bottom:5px;margin-top:4px;">UI Components</div>
          <div>${sc.components.map(c => `<span style="background:#e0f2fe;color:#0369a1;border-radius:4px;padding:2px 8px;font-size:8.5pt;margin:2px;display:inline-block;">${esc(c)}</span>`).join("")}</div>
        </div>`).join("")}
    </div>`;

  // Section 6 — Integration Requirements
  const sec6 = `
    <div class="section">
      ${sectionHeader("6", s.integration_requirements.title, "#0284c7")}
      <table>
        <thead><tr><th style="width:56px;">ID</th><th style="width:25%;">System</th><th style="width:80px;">Type</th><th>Description</th></tr></thead>
        <tbody>${s.integration_requirements.items.map(i => `
          <tr>
            <td><span style="font-family:monospace;font-weight:700;color:#7c3aed;">${esc(i.id)}</span></td>
            <td><b>${esc(i.system)}</b></td>
            <td>${badge(i.type, "#dbeafe", "#1d4ed8")}</td>
            <td>${esc(i.description)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  // Section 7 — Non-Functional Requirements
  const sec7 = `
    <div class="section">
      ${sectionHeader("7", s.non_functional_requirements.title, "#7c3aed")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${s.non_functional_requirements.items.map(n => `
          <div style="border:1px solid #ede9fe;border-radius:8px;padding:10px 12px;background:#faf5ff;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-size:9pt;font-weight:700;color:#7c3aed;">${esc(n.id)}</span>
              <span style="background:#ede9fe;color:#5b21b6;border-radius:4px;padding:1px 7px;font-size:8.5pt;font-weight:600;">${esc(n.category)}</span>
            </div>
            <div style="font-size:9.5pt;color:#334155;line-height:1.55;margin-bottom:6px;">${esc(n.requirement)}</div>
            <div style="font-family:monospace;font-size:8.5pt;background:#f0fdf4;color:#166534;padding:3px 7px;border-radius:4px;display:inline-block;">${esc(n.metric)}</div>
          </div>`).join("")}
      </div>
    </div>`;

  // Section 8 — Traceability Matrix
  const sec8 = `
    <div class="section">
      ${sectionHeader("8", s.traceability_matrix.title, "#64748b")}
      <table>
        <thead><tr><th style="width:90px;">BRD Ref</th><th style="width:90px;">FRD Ref</th><th>Traceability Description</th></tr></thead>
        <tbody>${s.traceability_matrix.mappings.map(t => `
          <tr>
            <td><span style="font-family:monospace;font-weight:700;color:#e11d48;">${esc(t.brd_ref)}</span></td>
            <td><span style="font-family:monospace;font-weight:700;color:#7c3aed;">${esc(t.frd_ref)}</span></td>
            <td>${esc(t.description)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  const tocTitles = [
    s.overview.title,
    s.functional_specifications.title,
    s.system_behavior.title,
    s.data_requirements.title,
    s.ui_requirements.title,
    s.integration_requirements.title,
    s.non_functional_requirements.title,
    s.traceability_matrix.title,
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(m.doc_id)} — ${esc(m.title)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="page">
  ${darkToolbar(m.doc_id, m.title)}
  ${buildFrdCover(m)}
  <div class="content">
    ${buildTOC(tocTitles)}
    ${aiNote}
    ${sec1}${sec2}${sec3}${sec4}${sec5}${sec6}${sec7}${sec8}
  </div>
  <div class="footer">
    <span>${esc(m.doc_id)} — v${esc(m.version)} &nbsp;|&nbsp; CONFIDENTIAL — INTERNAL USE</span>
    <span>Generated ${new Date(m.generated_at || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
    <span>BRD Ref: ${esc(m.brd_doc_id)}</span>
  </div>
</div>
</body>
</html>`;

  openPrintWindow(html);
}

// ─── Test Cases Types ─────────────────────────────────────────────────────────
interface TestStep { step_num: number; action: string; expected: string }
interface TestCase {
  id: string; frd_ref: string; name: string; description: string;
  type: string; priority: string; preconditions: string[];
  steps: TestStep[]; expected_result: string; status: string;
}
interface TcSummary { system: number; integration: number; uat: number; critical: number; high: number }
interface TcMeta {
  doc_id: string; frd_doc_id: string; brd_doc_id: string;
  title: string; version: string; total_cases: number;
  summary: TcSummary; request_number?: string;
}

// ─── TC Cover ─────────────────────────────────────────────────────────────────
function buildTcCover(meta: TcMeta): string {
  const sm = meta.summary ?? {};
  const stats: [string, string | number][] = [
    ["Document ID",   meta.doc_id],
    ["FRD Reference", meta.frd_doc_id],
    ["BRD Reference", meta.brd_doc_id],
    ["Version",       `v${meta.version ?? "1.0"}`],
    ["Total Cases",   meta.total_cases],
    ["Request Ref",   meta.request_number || "—"],
  ];
  const typeSplit: [string, string | number][] = [
    ["System",      sm.system ?? 0],
    ["Integration", sm.integration ?? 0],
    ["UAT",         sm.uat ?? 0],
    ["Critical",    sm.critical ?? 0],
    ["High",        sm.high ?? 0],
  ];
  return `
  <div style="background:linear-gradient(135deg,#0c4a6e 0%,#1e3a5f 40%,#1e1b4b 100%);padding:44px 36px 36px;color:#fff;">
    <div style="font-size:9pt;font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:#7dd3fc;margin-bottom:28px;">Test Case Specification</div>
    <div style="font-size:22pt;font-weight:800;line-height:1.2;margin-bottom:8px;">${esc(meta.title)}</div>
    <div style="font-size:11pt;color:#bae6fd;margin-bottom:32px;">Quality Assurance Document &nbsp;·&nbsp; ${meta.total_cases} Test Cases</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
      ${stats.map(([l, v]) => `
        <div class="stat-box">
          <div class="stat-label">${l}</div>
          <div class="stat-value" style="font-size:11pt;">${esc(v)}</div>
        </div>`).join("")}
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${typeSplit.map(([l, v]) => `
        <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:6px;padding:6px 14px;text-align:center;">
          <div style="font-size:8pt;text-transform:uppercase;letter-spacing:.06em;color:#7dd3fc;">${l}</div>
          <div style="font-size:14pt;font-weight:800;color:#fff;">${v}</div>
        </div>`).join("")}
    </div>
  </div>
  <div style="background:#f8fafc;border-bottom:2px solid #e2e8f0;padding:10px 36px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:9pt;color:#64748b;">Prepared by: <b>QA Portal — BPRM System</b></span>
    <span style="background:#dbeafe;color:#1d4ed8;border:1px solid #1d4ed833;border-radius:999px;padding:3px 12px;font-size:9pt;font-weight:700;">Test Specification</span>
  </div>`;
}

// ─── Test Cases PDF ───────────────────────────────────────────────────────────
export function downloadTestCasesAsPDF(meta: TcMeta, testCases: TestCase[]) {
  const TYPE_STYLE: Record<string, [string, string]> = {
    System:      ["#ede9fe", "#5b21b6"],
    Integration: ["#dbeafe", "#1d4ed8"],
    UAT:         ["#dcfce7", "#15803d"],
    Performance: ["#fef3c7", "#92400e"],
    Security:    ["#ffe4e6", "#9f1239"],
  };
  const PRIORITY_STYLE: Record<string, [string, string]> = {
    Critical: ["#ffe4e6", "#9f1239"],
    High:     ["#fef3c7", "#92400e"],
    Medium:   ["#e0f2fe", "#0369a1"],
    Low:      ["#f3f4f6", "#6b7280"],
  };
  const STATUS_STYLE: Record<string, [string, string]> = {
    Pass:    ["#dcfce7", "#15803d"],
    Fail:    ["#ffe4e6", "#9f1239"],
    Pending: ["#fef3c7", "#92400e"],
    Blocked: ["#f3f4f6", "#6b7280"],
  };

  // Suite summary
  const sm = meta.summary ?? {};
  const summarySection = `
    <div class="section">
      ${sectionHeader("S", "Test Suite Summary", "#0891b2")}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
        ${[
          ["System Tests",      sm.system ?? 0,      "#ede9fe", "#5b21b6"],
          ["Integration Tests", sm.integration ?? 0, "#dbeafe", "#1d4ed8"],
          ["UAT Tests",         sm.uat ?? 0,         "#dcfce7", "#15803d"],
          ["Total Cases",       meta.total_cases,    "#f0f9ff", "#0369a1"],
        ].map(([l, v, bg, fg]) => `
          <div style="background:${bg};border-radius:8px;padding:12px 14px;text-align:center;">
            <div style="font-size:24pt;font-weight:900;color:${fg};line-height:1;">${v}</div>
            <div style="font-size:8.5pt;color:#64748b;font-weight:600;margin-top:4px;">${l}</div>
          </div>`).join("")}
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:9pt;font-weight:600;color:#64748b;">Priority Breakdown:</span>
        ${badge("Critical — " + (sm.critical ?? 0), "#ffe4e6", "#9f1239")}
        ${badge("High — " + (sm.high ?? 0),         "#fef3c7", "#92400e")}
        ${badge("Total — " + meta.total_cases,       "#e0e7ff", "#4338ca")}
      </div>
    </div>`;

  // Individual test cases
  const casesHtml = testCases.map((tc, idx) => {
    const [typeBg, typeFg]         = TYPE_STYLE[tc.type]         ?? ["#f3f4f6", "#374151"];
    const [prioBg, prioFg]         = PRIORITY_STYLE[tc.priority] ?? ["#f3f4f6", "#374151"];
    const [statusBg, statusFg]     = STATUS_STYLE[tc.status]     ?? ["#f3f4f6", "#374151"];
    return `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:14px;page-break-inside:avoid;border-left:4px solid ${typeFg};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:12px;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-family:monospace;font-size:10pt;font-weight:800;color:#4338ca;">${esc(tc.id)}</span>
            <span style="font-size:8.5pt;color:#94a3b8;">← ${esc(tc.frd_ref)}</span>
            <span style="font-size:9pt;color:#94a3b8;">#${idx + 1}</span>
          </div>
          <div style="font-size:11pt;font-weight:700;color:#1e293b;">${esc(tc.name)}</div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">
          ${badge(tc.type,     typeBg,   typeFg)}
          ${badge(tc.priority, prioBg,   prioFg)}
          ${badge(tc.status,   statusBg, statusFg)}
        </div>
      </div>
      <p style="font-size:9.5pt;color:#475569;margin-bottom:10px;">${esc(tc.description)}</p>
      ${tc.preconditions?.length ? `
        <div class="label" style="margin-bottom:5px;color:#0369a1;">Preconditions</div>
        <ul class="bullets" style="margin-bottom:10px;">
          ${tc.preconditions.map(p => `<li>${esc(p)}</li>`).join("")}
        </ul>` : ""}
      <div class="label" style="margin-bottom:6px;color:#4338ca;">Test Steps</div>
      <table style="margin-bottom:10px;">
        <thead>
          <tr>
            <th style="width:36px;">#</th>
            <th style="width:50%;">Action</th>
            <th>Expected Result</th>
          </tr>
        </thead>
        <tbody>
          ${tc.steps.map(step => `
            <tr>
              <td style="text-align:center;font-weight:800;color:#4338ca;">${step.step_num}</td>
              <td>${esc(step.action)}</td>
              <td style="color:#065f46;">${esc(step.expected)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div style="padding:8px 12px;background:#f0fdf4;border-radius:6px;border-left:3px solid #16a34a;font-size:9.5pt;color:#15803d;">
        <b>Overall Expected Result:</b> ${esc(tc.expected_result)}
      </div>
    </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(meta.doc_id)} — ${esc(meta.title)}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="page">
  ${darkToolbar(meta.doc_id, meta.title)}
  ${buildTcCover(meta)}
  <div class="content">
    ${summarySection}
    <div class="section">
      ${sectionHeader("T", `Test Cases (${testCases.length})`, "#4338ca")}
      ${casesHtml}
    </div>
  </div>
  <div class="footer">
    <span>${esc(meta.doc_id)} — v${esc(meta.version ?? "1.0")} &nbsp;|&nbsp; CONFIDENTIAL — INTERNAL USE</span>
    <span>Generated ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</span>
    <span>FRD Ref: ${esc(meta.frd_doc_id)} &nbsp;|&nbsp; BRD Ref: ${esc(meta.brd_doc_id)}</span>
  </div>
</div>
</body>
</html>`;

  openPrintWindow(html);
}
