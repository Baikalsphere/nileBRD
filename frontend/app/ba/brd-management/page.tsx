"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, Sparkles, CheckCircle2, XCircle,
  Clock, Tag, Users, ClipboardList, ShieldAlert, Zap,
  BarChart3, BookOpen, Printer, RefreshCw,
  MessageSquare, ArrowUpRight, Loader2, Info,
  Eye, Download, ChevronLeft, X, Send, ArrowRight,
  GitBranch, Shield, Database, ArrowRightCircle,
} from "lucide-react";

import { buildPdfHtml, openPdf, type BrdDoc } from "@/lib/brdPdf";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BrdListItem {
  id: number;
  doc_id: string;
  version: string;
  status: "Draft" | "In Review" | "Approved" | "Final";
  generated_at: string;
  updated_at: string;
  request_id: number;
  request_title: string;
  req_number: string;
  priority: string;
  category: string;
  source_messages: string;
  reviews_pending: string;
  reviews_approved: string;
  reviews_changes: string;
  reviews_total: string;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  "Must Have":   "bg-rose-100 text-rose-700 border-rose-200",
  "Should Have": "bg-amber-100 text-amber-700 border-amber-200",
  "Could Have":  "bg-sky-100 text-sky-700 border-sky-200",
  "Won't Have":  "bg-slate-100 text-slate-500 border-slate-200",
};
const IMPACT_COLORS: Record<string, string> = {
  High: "bg-rose-100 text-rose-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-emerald-100 text-emerald-700",
};
const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-amber-50 text-amber-700 border-amber-200",
  "In Review": "bg-blue-50 text-blue-700 border-blue-200",
  Approved: "bg-violet-50 text-violet-700 border-violet-200",
  Final: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-emerald-400", Medium: "bg-amber-400", High: "bg-orange-500", Critical: "bg-rose-500",
};

// ─── PDF Generator (imported from @/lib/brdPdf) ───────────────────────────────
function _buildPdfHtml(doc: BrdDoc): string {
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

    <!-- Print button (hidden on print) -->
    <div class="no-print" style="display:flex;justify-content:flex-end;margin-bottom:24px;gap:8px">
      <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
        ⬇ Download / Print as PDF
      </button>
      <button onclick="window.close()" style="background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
        Close
      </button>
    </div>

    <!-- Cover Page -->
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

    <!-- 1. Executive Summary -->
    <div class="section">
      <h2>1. Executive Summary</h2>
      <p style="font-size:14px;line-height:1.7;color:#334155">${s.executive_summary.text}</p>
    </div>

    <!-- 2. Business Objective -->
    <div class="section">
      <h2>2. Business Objective &amp; Goals</h2>
      <p style="font-size:14px;line-height:1.7;color:#334155;margin-bottom:16px">${s.objective.text}</p>
      ${goals ? `<ul style="padding-left:20px;list-style:disc">${goals}</ul>` : ""}
    </div>

    <!-- 3. Scope -->
    <div class="section">
      <h2>3. Scope</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#16a34a;margin-bottom:10px">✓ In Scope</div>
          <ul style="list-style:disc;padding-left:18px">${inScope}</ul>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#dc2626;margin-bottom:10px">✗ Out of Scope</div>
          <ul style="list-style:disc;padding-left:18px">${outScope}</ul>
        </div>
      </div>
    </div>

    <!-- 4. Stakeholders -->
    <div class="section">
      <h2>4. Stakeholder Analysis</h2>
      <table>
        <thead><tr><th style="width:35%">Name</th><th>Role / Responsibility</th></tr></thead>
        <tbody>${stRows}</tbody>
      </table>
    </div>

    <!-- 5. Functional Requirements -->
    <div class="section">
      <h2>5. Functional Requirements</h2>
      ${s.functional_requirements.items.length ? `
      <table>
        <thead><tr><th style="width:70px">ID</th><th>Requirement</th><th style="width:130px">Priority</th></tr></thead>
        <tbody>${frRows}</tbody>
      </table>` : '<p style="font-size:13px;color:#94a3b8;font-style:italic">No functional requirements extracted.</p>'}
    </div>

    <!-- 6. Non-Functional Requirements -->
    ${s.non_functional_requirements.items.length ? `
    <div class="section">
      <h2>6. Non-Functional Requirements</h2>
      ${nfrCards}
    </div>` : ""}

    <!-- 7. Risk Register -->
    ${s.risk_register.items.length ? `
    <div class="section">
      <h2>7. Risk Register</h2>
      <table>
        <thead><tr><th style="width:60px">ID</th><th>Risk Description</th><th style="width:80px">Impact</th><th style="width:90px">Probability</th><th>Mitigation Strategy</th></tr></thead>
        <tbody>${riskRows}</tbody>
      </table>
    </div>` : ""}

    <!-- 8. Action Items -->
    ${s.action_items.items.length ? `
    <div class="section">
      <h2>8. Action Items &amp; Next Steps</h2>
      ${actions}
    </div>` : ""}

    <!-- 9. BRD Readiness -->
    <div class="section">
      <h2>9. BRD Readiness Assessment</h2>
      <div style="display:flex;align-items:flex-start;gap:32px">
        <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px 32px;flex-shrink:0">
          <div style="font-size:40px;font-weight:900;color:${s.brd_readiness.score >= 5 ? "#16a34a" : s.brd_readiness.score >= 3 ? "#d97706" : "#dc2626"}">${s.brd_readiness.score}/5</div>
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-top:4px">Readiness Score</div>
        </div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;color:${s.brd_readiness.score >= 5 ? "#16a34a" : s.brd_readiness.score >= 3 ? "#d97706" : "#dc2626"};margin-bottom:12px">${s.brd_readiness.readinessLevel}</div>
          ${readinessChecks}
        </div>
      </div>
    </div>

    <!-- Appendix -->
    <div class="section">
      <h2>Appendix A: Key Conversation Excerpts</h2>
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">Key Topics</div>
        <div>${keywords}</div>
      </div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">Source Conversations (${s.appendix.messages.length} marked)</div>
      ${sourceMessages}
    </div>

    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8">
      <span>${meta.doc_id} — v${meta.version}</span>
      <span>Generated ${new Date(meta.generated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} · ${meta.ai_models[0]}</span>
    </div>

  </div>
</body>
</html>`;
}


// ─── BRD Viewer Modal ─────────────────────────────────────────────────────────
function BrdViewerModal({ doc, onClose, onUpdateStatus }: { doc: BrdDoc; onClose: () => void; onUpdateStatus: (s: string) => void }) {
  const s = doc.sections;
  const score = s.brd_readiness.score;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-400 rounded-t-2xl shrink-0" />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
              <FileText className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">{doc.meta.title}</p>
              <p className="text-[11px] text-slate-400 font-mono">{doc.meta.doc_id} · v{doc.meta.version}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              defaultValue={doc._status ?? doc.meta.status}
              onChange={e => onUpdateStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {["Draft", "In Review", "Approved", "Final"].map(s => <option key={s}>{s}</option>)}
            </select>
            <button
              onClick={() => openPdf(doc)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              <Printer className="size-3.5" /> PDF
            </button>
            <button onClick={onClose} className="flex size-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Cover */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 p-7 text-white shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold">{doc.meta.request_number}</span>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold">{doc.meta.category}</span>
                  <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold">
                    <span className={`size-1.5 rounded-full ${PRIORITY_DOT[doc.meta.priority] ?? "bg-amber-400"}`} />
                    {doc.meta.priority}
                  </span>
                </div>
                <h2 className="text-xl font-bold leading-tight">{doc.meta.title}</h2>
                <p className="text-xs text-white/70 mt-1">Business Requirements Document</p>
              </div>
              <p className="text-4xl font-black text-white/20">BRD</p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[["Version", `v${doc.meta.version}`], ["Status", doc.meta.status], ["Date", doc.meta.effective_date], ["Sources", `${doc.meta.source_messages} pts`]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-white/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">{l}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 1 — Executive Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">1</div>
              <BarChart3 className="size-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-800">{s.executive_summary.title}</h3>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <p className="text-sm leading-relaxed text-slate-700">{s.executive_summary.text}</p>
          </div>

          {/* 2 — Business Objective & Goals */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">2</div>
              <BookOpen className="size-4 text-violet-500" />
              <h3 className="text-sm font-bold text-slate-800">{s.objective.title}</h3>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <p className="text-sm leading-relaxed text-slate-700 mb-3">{s.objective.text}</p>
            <ul className="space-y-1.5">{s.objective.goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2"><CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-violet-400" /><span className="text-sm text-slate-700">{g}</span></li>
            ))}</ul>
          </div>

          {/* 3 — Scope (summary + in/out + process flow) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">3</div>
              <Info className="size-4 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-800">{s.scope.title}</h3>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            {(s.scope as any).summary && (
              <p className="text-sm leading-relaxed text-slate-600 mb-4 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">{(s.scope as any).summary}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">✓ In Scope</p>
                <ul className="space-y-1">{s.scope.in_scope.map((it, i) => (
                  <li key={i} className="flex gap-2 items-start text-sm text-slate-700"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400" />{it}</li>
                ))}</ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">✗ Out of Scope</p>
                <ul className="space-y-1">{s.scope.out_of_scope.map((it, i) => (
                  <li key={i} className="flex gap-2 items-start text-sm text-slate-600"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rose-400" />{it}</li>
                ))}</ul>
              </div>
            </div>
            {/* Process Flow */}
            {(s.scope as any).process_flow?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-1.5"><GitBranch className="size-3.5" /> End-to-End Business Process Flow</p>
                <div className="space-y-2">
                  {((s.scope as any).process_flow as Array<{step:number;actor:string;action:string;outcome:string}>).map((step) => (
                    <div key={step.step} className="flex gap-3 items-start rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white mt-0.5">{step.step}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 shrink-0">{step.actor}</span>
                          <ArrowRightCircle className="size-3 text-indigo-300 shrink-0" />
                          <span className="text-xs font-medium text-slate-800">{step.action}</span>
                        </div>
                        <p className="text-[10px] text-emerald-700 font-medium">→ {step.outcome}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5 — Functional Requirements */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">5</div>
              <ClipboardList className="size-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-800">{s.functional_requirements.title}</h3>
              <span className="ml-auto rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{s.functional_requirements.items.length} requirements</span>
            </div>
            {s.functional_requirements.items.length ? (
              <div className="space-y-3">
                {s.functional_requirements.items.map(fr => (
                  <div key={fr.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-indigo-600">{fr.id}</span>
                        {(fr as any).title && <span className="text-xs font-semibold text-slate-700">{(fr as any).title}</span>}
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORITY_COLORS[fr.priority] ?? PRIORITY_COLORS["Must Have"]}`}>{fr.priority}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">{fr.description}</p>
                    {(fr as any).rationale && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                        <Info className="size-3 shrink-0 text-amber-500 mt-0.5" />
                        <p className="text-[10px] text-amber-700 leading-relaxed"><span className="font-bold">Rationale: </span>{(fr as any).rationale}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 italic">No functional requirements extracted.</p>}
          </div>

          {/* 6 — Non-Functional Requirements */}
          {s.non_functional_requirements?.items?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">6</div>
                <Shield className="size-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-800">{s.non_functional_requirements.title}</h3>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {s.non_functional_requirements.items.map(nfr => (
                  <div key={nfr.id} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="font-mono text-[10px] font-bold text-indigo-400">{nfr.id}</span>
                      <span className="text-xs font-bold text-slate-700">{nfr.category}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{nfr.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7 — Business Rules */}
          {(s as any).business_rules?.items?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">7</div>
                <Tag className="size-4 text-violet-500" />
                <h3 className="text-sm font-bold text-slate-800">{(s as any).business_rules.title}</h3>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="space-y-2">
                {(s as any).business_rules.items.map((br: { id: string; description: string }) => (
                  <div key={br.id} className="flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3">
                    <span className="font-mono text-[10px] font-bold text-violet-600 shrink-0 mt-0.5 w-10">{br.id}</span>
                    <p className="text-xs text-slate-700 leading-relaxed">{br.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8 — Integration Requirements */}
          {(s as any).integration_requirements?.items?.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">8</div>
                <GitBranch className="size-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-800">{(s as any).integration_requirements.title}</h3>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="space-y-3">
                {(s as any).integration_requirements.items.map((int: {
                  id: string; system: string; type: string; direction?: string;
                  input?: string; output?: string; auth?: string; sla?: string; description: string;
                }) => (
                  <div key={int.id} className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-blue-600">{int.id}</span>
                        <span className="text-xs font-bold text-slate-800">{int.system}</span>
                        <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{int.direction || int.type}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">{int.description}</p>
                    {(int.input || int.output || int.auth || int.sla) && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                        {int.input  && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Input</p><p className="text-[10px] text-slate-600">{int.input}</p></div>}
                        {int.output && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Output</p><p className="text-[10px] text-slate-600">{int.output}</p></div>}
                        {int.auth   && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">Auth</p><p className="text-[10px] text-slate-600">{int.auth}</p></div>}
                        {int.sla    && <div><p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">SLA</p><p className="text-[10px] text-emerald-700 font-semibold">{int.sla}</p></div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9 — Risk Register */}
          {s.risk_register.items.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">9</div>
                <ShieldAlert className="size-4 text-rose-500" />
                <h3 className="text-sm font-bold text-slate-800">{s.risk_register.title}</h3>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100">
                    {["ID","Risk","Impact","Prob.","Mitigation"].map(h => <th key={h} className="py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {s.risk_register.items.map(r => (
                      <tr key={r.id}>
                        <td className="py-2.5 pr-3 font-mono text-xs font-bold text-rose-500">{r.id}</td>
                        <td className="py-2.5 pr-3 text-slate-700 leading-relaxed">{r.description}</td>
                        <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${IMPACT_COLORS[r.impact] ?? IMPACT_COLORS.Medium}`}>{r.impact}</span></td>
                        <td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${IMPACT_COLORS[r.probability] ?? IMPACT_COLORS.Medium}`}>{r.probability}</span></td>
                        <td className="py-2.5 text-xs text-slate-600 leading-relaxed">{r.mitigation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 11 — Readiness */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-[11px] font-bold text-white">11</div>
              <CheckCircle2 className="size-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-800">{s.brd_readiness.title}</h3>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-5 shrink-0">
                <span className={`text-4xl font-black ${score >= 5 ? "text-emerald-500" : score >= 3 ? "text-amber-500" : "text-rose-500"}`}>{score}/5</span>
                <span className="text-[10px] text-slate-500 mt-1">Readiness</span>
              </div>
              <div>
                <p className={`text-sm font-bold mb-3 ${score >= 5 ? "text-emerald-600" : score >= 3 ? "text-amber-600" : "text-rose-600"}`}>{s.brd_readiness.readinessLevel}</p>
                <ul className="grid sm:grid-cols-2 gap-1.5">
                  {(s.brd_readiness.checks || []).map(c => (
                    <li key={c.label} className="flex items-center gap-2">
                      {c.pass ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" /> : <XCircle className="size-3.5 shrink-0 text-slate-300" />}
                      <span className={`text-xs ${c.pass ? "text-slate-700" : "text-slate-400"}`}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BRDManagementPage() {
  const [brdList, setBrdList]       = useState<BrdListItem[]>([]);
  const [loadingList, setLoading]   = useState(true);
  const [viewingDoc, setViewingDoc] = useState<BrdDoc | null>(null);
  const [loadingId, setLoadingId]   = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [postingId, setPostingId]     = useState<number | null>(null);
  const [enhancingId, setEnhancingId] = useState<number | null>(null);
  const [sendingItId, setSendingItId] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setBrdList(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openView = useCallback(async (id: number) => {
    setLoadingId(id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setViewingDoc(await res.json());
    } finally { setLoadingId(null); }
  }, []);

  const openPdfDirect = useCallback(async (id: number) => {
    // Open window synchronously within the click event to avoid popup blockers in prod.
    const win = window.open("", "_blank");
    if (!win) { alert("Allow popups for this site to open the BRD PDF."); return; }
    win.document.write(
      "<html><body style='font-family:sans-serif;padding:40px;color:#64748b'>Loading BRD…</body></html>"
    );
    setLoadingId(id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const doc = await res.json();
        win.document.open();
        win.document.write(buildPdfHtml(doc));
        win.document.close();
      } else {
        win.close();
      }
    } catch { win.close(); }
    finally { setLoadingId(null); }
  }, []);

  const updateStatus = useCallback(async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      const token = localStorage.getItem("authToken");
      await fetch(`${API}/api/stream/brd-documents/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setBrdList(prev => prev.map(b => b.id === id ? { ...b, status: status as BrdListItem["status"] } : b));
    } finally { setUpdatingId(null); }
  }, []);

  const postToChannel = useCallback(async (id: number) => {
    setPostingId(id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${id}/post-to-channel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Failed to post BRD"); return; }
      alert(`BRD posted to discussion channel. ${data.reviewers} reviewer(s) notified.`);
      fetchList();
    } finally { setPostingId(null); }
  }, [fetchList]);

  const sendToItManager = useCallback(async (id: number) => {
    setSendingItId(id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${id}/send-to-it-manager`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Failed to send to IT Manager"); return; }
      alert(`BRD sent to IT Manager${data.itManager ? ` (${data.itManager})` : ""}. Status updated to Final.`);
      fetchList();
    } finally { setSendingItId(null); }
  }, [fetchList]);

  const enhanceFromFeedback = useCallback(async (id: number) => {
    setEnhancingId(id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${id}/enhance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); alert(d.message || "Enhancement failed"); return; }
      fetchList();
    } finally { setEnhancingId(null); }
  }, [fetchList]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
            <FileText className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">BRD Management</h1>
            <p className="text-xs text-slate-500">AI-generated Business Requirements Documents</p>
          </div>
        </div>
        <button
          onClick={fetchList}
          disabled={loadingList}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loadingList ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loadingList ? (
          <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading documents…</span>
          </div>
        ) : brdList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-100 border-2 border-dashed border-indigo-200">
              <FileText className="size-9 text-indigo-300" />
            </div>
            <p className="text-base font-bold text-slate-600">No BRD documents yet</p>
            <p className="mt-2 text-sm text-slate-400 max-w-sm leading-relaxed">
              Open a Discussion chat → generate Key Points → click "Generate Draft BRD" in the analysis panel.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {[
                  { label: "Document ID", w: "w-44" },
                  { label: "Request" },
                  { label: "Category",  w: "w-28" },
                  { label: "Priority",  w: "w-24" },
                  { label: "Status",    w: "w-28" },
                  { label: "Version",   w: "w-16" },
                  { label: "Date",      w: "w-28" },
                  { label: "Reviews",   w: "w-28" },
                  { label: "Actions",   w: "w-56" },
                ].map(({ label, w }) => (
                  <th key={label} className={`${w ?? ""} px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brdList.map(brd => (
                <tr key={brd.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Doc ID */}
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs font-bold text-indigo-600">{brd.doc_id}</span>
                  </td>

                  {/* Request */}
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-800 leading-snug">{brd.request_title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">{brd.req_number}</p>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-600">{brd.category}</span>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_DOT[brd.priority] ?? "bg-slate-300"}`} />
                      {brd.priority}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <select
                      defaultValue={brd.status}
                      onChange={e => updateStatus(brd.id, e.target.value)}
                      disabled={updatingId === brd.id}
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold cursor-pointer focus:outline-none ${STATUS_COLORS[brd.status] ?? STATUS_COLORS.Draft}`}
                    >
                      {["Draft","In Review","Approved","Final"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>

                  {/* Version */}
                  <td className="px-4 py-4">
                    <span className="text-xs font-mono text-slate-500">v{brd.version}</span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-500">
                      {new Date(brd.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </td>

                  {/* Reviews */}
                  <td className="px-4 py-4">
                    {parseInt(brd.reviews_total) === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-3 text-emerald-500" />
                          <span className="text-xs font-semibold text-slate-700">
                            {brd.reviews_approved}/{brd.reviews_total}
                          </span>
                          {parseInt(brd.reviews_approved) === parseInt(brd.reviews_total) && parseInt(brd.reviews_total) > 0 && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">All</span>
                          )}
                        </div>
                        {parseInt(brd.reviews_changes) > 0 && (
                          <span className="text-[10px] text-rose-600 font-medium">
                            {brd.reviews_changes} change req.
                          </span>
                        )}
                        {parseInt(brd.reviews_pending) > 0 && (
                          <span className="text-[10px] text-amber-600">
                            {brd.reviews_pending} pending
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* View */}
                      <button
                        onClick={() => openView(brd.id)}
                        disabled={loadingId === brd.id}
                        className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        {loadingId === brd.id ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
                        View
                      </button>

                      {/* PDF */}
                      <button
                        onClick={() => openPdfDirect(brd.id)}
                        disabled={loadingId === brd.id}
                        className="flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
                      >
                        <Download className="size-3" />
                        PDF
                      </button>

                      {/* Post to Channel — show when Draft or after enhancement */}
                      {(brd.status === "Draft" || brd.status === "In Review") && (
                        <button
                          onClick={() => postToChannel(brd.id)}
                          disabled={postingId === brd.id}
                          title="Share BRD to discussion channel for stakeholder review"
                          className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-50"
                        >
                          {postingId === brd.id ? <Loader2 className="size-3 animate-spin" /> : <MessageSquare className="size-3" />}
                          Share
                        </button>
                      )}

                      {/* Enhance from feedback — show when there are change requests */}
                      {parseInt(brd.reviews_changes) > 0 && (
                        <button
                          onClick={() => enhanceFromFeedback(brd.id)}
                          disabled={enhancingId === brd.id}
                          title={`Enhance BRD with ${brd.reviews_changes} improvement comment(s)`}
                          className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                          {enhancingId === brd.id ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                          Enhance
                        </button>
                      )}

                      {/* Send to IT Manager — only when Approved */}
                      {brd.status === "Approved" && (
                        <button
                          onClick={() => sendToItManager(brd.id)}
                          disabled={sendingItId === brd.id}
                          title="Send approved BRD to IT Manager for implementation"
                          className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        >
                          {sendingItId === brd.id ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />}
                          Send to IT
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tip */}
      {brdList.length > 0 && (
        <p className="text-center text-xs text-slate-400">
          <Sparkles className="inline size-3 text-amber-400 mr-1" />
          <strong>View</strong> reads the document · <strong>PDF</strong> exports it · <strong>Share</strong> posts it to the channel for stakeholder review · <strong>Enhance</strong> runs AI improvement from feedback · <strong>Send to IT</strong> forwards the approved BRD to the IT Manager
        </p>
      )}

      {/* Viewer modal */}
      {viewingDoc && (
        <BrdViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onUpdateStatus={s => {
            if (viewingDoc._db_id) updateStatus(viewingDoc._db_id, s);
          }}
        />
      )}
    </div>
  );
}
