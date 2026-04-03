// Shared BRD PDF generation — used by BRD Management page and BrdReviewCard in chat

export interface FRItem   { id: string; description: string; priority: string; source: string; original: string }
export interface NFRItem  { id: string; category: string; description: string }
export interface RiskItem { id: string; description: string; impact: string; probability: string; mitigation: string }
export interface ActionItem { id: string; description: string; status: string }
export interface Stakeholder { name: string; role: string }
export interface ReadinessCheck { label: string; pass: boolean }

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
    scope: { number: string; title: string; in_scope: string[]; out_of_scope: string[] };
    stakeholders: { number: string; title: string; list: Stakeholder[] };
    functional_requirements: { number: string; title: string; items: FRItem[] };
    non_functional_requirements: { number: string; title: string; items: NFRItem[] };
    risk_register: { number: string; title: string; items: RiskItem[] };
    action_items: { number: string; title: string; items: ActionItem[] };
    brd_readiness: { number: string; title: string; checks: ReadinessCheck[]; score: number; readinessLevel: string };
    appendix: { title: string; messages: { sender: string; text: string; marked_at: string }[]; keywords: string[] };
  };
}

export function buildPdfHtml(doc: BrdDoc): string {
  const s = doc.sections;
  const meta = doc.meta;

  const frRows = s.functional_requirements.items.map(fr => `
    <tr>
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;font-weight:700;color:#4338ca;border-bottom:1px solid #f1f5f9;white-space:nowrap">${fr.id}</td>
      <td style="padding:8px 12px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;line-height:1.5">${fr.description}</td>
      <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;white-space:nowrap">
        <span style="background:${fr.priority === "Must Have" ? "#fee2e2" : fr.priority === "Should Have" ? "#fef3c7" : "#e0f2fe"};color:${fr.priority === "Must Have" ? "#b91c1c" : fr.priority === "Should Have" ? "#b45309" : "#0369a1"};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${fr.priority}</span>
      </td>
    </tr>`).join("");

  const riskRows = s.risk_register.items.map(r => `
    <tr>
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;font-weight:700;color:#dc2626;border-bottom:1px solid #f1f5f9">${r.id}</td>
      <td style="padding:8px 12px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;line-height:1.5">${r.description}</td>
      <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9"><span style="background:${r.impact === "High" ? "#fee2e2" : r.impact === "Medium" ? "#fef3c7" : "#dcfce7"};padding:2px 8px;border-radius:999px;font-weight:700">${r.impact}</span></td>
      <td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9"><span style="background:${r.probability === "High" ? "#fee2e2" : r.probability === "Medium" ? "#fef3c7" : "#dcfce7"};padding:2px 8px;border-radius:999px;font-weight:700">${r.probability}</span></td>
      <td style="padding:8px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;line-height:1.4">${r.mitigation}</td>
    </tr>`).join("");

  const stRows = s.stakeholders.list.map(st => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9">${st.name}</td>
      <td style="padding:8px 12px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9">${st.role}</td>
    </tr>`).join("");

  const nfrCards = s.non_functional_requirements.items.map(n => `
    <div style="border:1px solid #e0e7ff;background:#eef2ff;border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:4px">${n.id} · ${n.category}</div>
      <div style="font-size:12px;color:#334155;line-height:1.5">${n.description}</div>
    </div>`).join("");

  const readinessChecks = (s.brd_readiness.checks || []).map(c => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:14px;color:${c.pass ? "#16a34a" : "#94a3b8"}">${c.pass ? "✓" : "✗"}</span>
      <span style="font-size:13px;color:${c.pass ? "#1e293b" : "#94a3b8"}">${c.label}</span>
    </div>`).join("");

  const keywords = (s.appendix.keywords || []).map(k =>
    `<span style="background:#f3e8ff;color:#7c3aed;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;margin:2px;display:inline-block">${k}</span>`
  ).join("");

  const sourceMessages = (s.appendix.messages || []).map(m => `
    <div style="border:1px solid #f1f5f9;background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:8px">
      <div style="font-size:13px;color:#334155;line-height:1.5;margin-bottom:4px">"${m.text}"</div>
      <div style="font-size:11px;font-weight:600;color:#94a3b8">${m.sender} · ${new Date(m.marked_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
    </div>`).join("");

  const goals = s.objective.goals.map(g =>
    `<li style="font-size:13px;color:#334155;line-height:1.6;margin-bottom:4px">${g}</li>`
  ).join("");

  const inScope = s.scope.in_scope.map(i =>
    `<li style="font-size:13px;color:#334155;margin-bottom:4px;line-height:1.5">${i}</li>`
  ).join("");

  const outScope = s.scope.out_of_scope.map(i =>
    `<li style="font-size:13px;color:#64748b;margin-bottom:4px;line-height:1.5">${i}</li>`
  ).join("");

  const actions = s.action_items.items.map(a => `
    <div style="display:flex;align-items:flex-start;gap:12px;border:1px solid #e0f2fe;background:#f0f9ff;border-radius:8px;padding:10px 14px;margin-bottom:8px">
      <span style="font-family:monospace;font-size:11px;font-weight:700;color:#0284c7;white-space:nowrap;margin-top:1px">${a.id}</span>
      <span style="font-size:13px;color:#334155;flex:1;line-height:1.5">${a.description}</span>
      <span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap">${a.status}</span>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${meta.doc_id} — BRD</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1e293b; }
    .page { max-width: 900px; margin: 0 auto; padding: 40px; }
    h2 { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1e293b; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    @media print {
      body { font-size: 12px; }
      .no-print { display: none !important; }
      .page { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:24px;gap:8px">
      <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">⬇ Download / Print as PDF</button>
      <button onclick="window.close()" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Close</button>
    </div>
    <div style="border:2px solid #1e293b;border-radius:12px;padding:40px;margin-bottom:40px;text-align:center">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:16px">Business Requirements Document</div>
      <div style="font-size:28px;font-weight:900;color:#1e293b;margin-bottom:8px;line-height:1.2">${meta.title}</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:32px">${meta.category} · ${meta.priority} Priority</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:left;border-top:1px solid #e2e8f0;padding-top:24px">
        <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:4px">Document ID</div><div style="font-size:14px;font-weight:700;color:#1e293b">${meta.doc_id}</div></div>
        <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:4px">Version</div><div style="font-size:14px;font-weight:700;color:#1e293b">v${meta.version}</div></div>
        <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:4px">Status</div><div style="font-size:14px;font-weight:700;color:#1e293b">${meta.status}</div></div>
        <div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:4px">Effective Date</div><div style="font-size:14px;font-weight:700;color:#1e293b">${meta.effective_date}</div></div>
      </div>
      <div style="margin-top:16px;text-align:left;border-top:1px solid #f1f5f9;padding-top:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px">AI Models</div>
        <div style="font-size:11px;color:#64748b">${meta.ai_models.join(" · ")}</div>
      </div>
    </div>
    <div class="section"><h2>1. Executive Summary</h2><p style="font-size:14px;line-height:1.7;color:#334155">${s.executive_summary.text}</p></div>
    <div class="section"><h2>2. Business Objective &amp; Goals</h2><p style="font-size:14px;line-height:1.7;color:#334155;margin-bottom:16px">${s.objective.text}</p>${goals ? `<ul style="padding-left:20px;list-style:disc">${goals}</ul>` : ""}</div>
    <div class="section"><h2>3. Scope</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px"><div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#16a34a;margin-bottom:10px">✓ In Scope</div><ul style="list-style:disc;padding-left:18px">${inScope}</ul></div><div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#dc2626;margin-bottom:10px">✗ Out of Scope</div><ul style="list-style:disc;padding-left:18px">${outScope}</ul></div></div></div>
    <div class="section"><h2>4. Stakeholder Analysis</h2><table><thead><tr><th style="width:35%">Name</th><th>Role / Responsibility</th></tr></thead><tbody>${stRows}</tbody></table></div>
    <div class="section"><h2>5. Functional Requirements</h2>${s.functional_requirements.items.length ? `<table><thead><tr><th style="width:70px">ID</th><th>Requirement</th><th style="width:130px">Priority</th></tr></thead><tbody>${frRows}</tbody></table>` : '<p style="font-size:13px;color:#94a3b8;font-style:italic">No functional requirements extracted.</p>'}</div>
    ${s.non_functional_requirements.items.length ? `<div class="section"><h2>6. Non-Functional Requirements</h2>${nfrCards}</div>` : ""}
    ${s.risk_register.items.length ? `<div class="section"><h2>7. Risk Register</h2><table><thead><tr><th style="width:60px">ID</th><th>Risk Description</th><th style="width:80px">Impact</th><th style="width:90px">Probability</th><th>Mitigation Strategy</th></tr></thead><tbody>${riskRows}</tbody></table></div>` : ""}
    ${s.action_items.items.length ? `<div class="section"><h2>8. Action Items &amp; Next Steps</h2>${actions}</div>` : ""}
    <div class="section"><h2>9. BRD Readiness Assessment</h2><div style="display:flex;align-items:flex-start;gap:32px"><div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px 32px;flex-shrink:0"><div style="font-size:40px;font-weight:900;color:${s.brd_readiness.score >= 5 ? "#16a34a" : s.brd_readiness.score >= 3 ? "#d97706" : "#dc2626"}">${s.brd_readiness.score}/5</div><div style="font-size:11px;color:#64748b;font-weight:600;margin-top:4px">Readiness Score</div></div><div style="flex:1"><div style="font-size:14px;font-weight:700;color:${s.brd_readiness.score >= 5 ? "#16a34a" : s.brd_readiness.score >= 3 ? "#d97706" : "#dc2626"};margin-bottom:12px">${s.brd_readiness.readinessLevel}</div>${readinessChecks}</div></div></div>
    <div class="section"><h2>Appendix A: Key Conversation Excerpts</h2><div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">Key Topics</div><div>${keywords}</div></div><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">Source Conversations (${s.appendix.messages.length} marked)</div>${sourceMessages}</div>
    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8"><span>${meta.doc_id} — v${meta.version}</span><span>Generated ${new Date(meta.generated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} · ${meta.ai_models[0]}</span></div>
  </div>
</body>
</html>`;
}

export function openPdf(doc: BrdDoc) {
  const html = buildPdfHtml(doc);
  const win = window.open("", "_blank");
  if (!win) { alert("Allow popups for this site to open the BRD PDF."); return; }
  win.document.write(html);
  win.document.close();
}
