// Helpers that turn a compact department definition into a full report outline + questionnaire.
// Every report follows the same consulting skeleton: executive summary → governance → the
// department's own frameworks → SOPs, forms, registers, KPI dashboard, policies, checklists →
// 3-phase roadmap → conclusion.

import type { SkeletonItem } from "@/lib/report-context";

export type QuestionDef = {
  code: string;
  dimension: string;
  text: string;
  weight?: number;
  answer_type?: "maturity" | "text" | "number" | "yes_no";
};

export type DepartmentDef = {
  code: string;
  prefix: string; // used for SOP / policy / checklist codes, e.g. "SA" → SOP SA-01
  name: string;
  name_ar: string;
  description: string;
  report_title: string;
  sort: number;
  gapsTitle: string; // e.g. "CRITICAL COMMERCIAL GAPS — CURRENT STATE"
  governance: string; // what the roles table must cover
  frameworks: { key: string; title: string; guidance: string }[];
  sops: string;
  forms: string;
  registers: string;
  kpis: string;
  policies: string;
  checklists: string;
  roadmapFocus: string;
  outcomes: string;
  questions: QuestionDef[];
};

export function buildSkeleton(d: DepartmentDef): SkeletonItem[] {
  const p = d.prefix;
  return [
    {
      key: "exec_summary",
      title: `Executive Summary — ${d.name} Maturity Assessment`,
      guidance: `Business context (who the client is, branches, what they sell, why ${d.name.toLowerCase()} matters for them). State the maturity score. A critical callout titled ${d.gapsTitle} built only from questionnaire answers rated 0–1 and red metrics. A short paragraph on what this report delivers. Quote client figures if any were provided.`,
      tier: "analysis",
    },
    {
      key: "governance",
      title: `${d.name} Governance Architecture — Roles, Accountability & Reporting`,
      guidance: `Table: Role | Primary responsibility | Reports to | KPI accountability | Meeting obligation. ${d.governance} Use the client's real people and positions where known. Show segregation of duties.`,
      tier: "analysis",
    },
    ...d.frameworks.map((f) => ({ ...f, tier: "analysis" as const })),
    {
      key: "sops",
      title: `Standard Operating Procedures — ${d.name} SOPs`,
      guidance: `Write 6–8 complete SOPs: ${d.sops}. Each SOP starts with a level-2 heading "SOP ${p}-01: <NAME>", then a two-column table (Objective, Scope, Owner, Zero-Tolerance Rule); a Step-by-Step Workflow table (Step | Process action | Responsible | Output / document | Timeline); then Controls, Risks & Governance Requirements bullets.`,
      tier: "template",
    },
    {
      key: "forms",
      title: `${d.name} Forms & Templates`,
      guidance: `Reproduce 4–6 ready-to-use forms: ${d.forms}. Each form starts with a level-2 heading "FORM ${p}-01: <NAME>", then a field table (Field | Details / entry) with blank entry cells, then an approval and signature table.`,
      tier: "template",
    },
    {
      key: "registers",
      title: `${d.name} Registers, Trackers & Databases`,
      guidance: `For each register (${d.registers}): a level-2 heading "REG ${p}-01: <NAME>", a paragraph with purpose, owner and update frequency, and a table of its fields (Field | Description | Example).`,
      tier: "template",
    },
    {
      key: "dashboard",
      title: `${d.name} Dashboard & KPI Framework`,
      guidance: `Dashboard panels table (Panel | What it shows | Green | Amber | Red). KPI table (KPI | Formula | Target | Frequency | Owner) covering: ${d.kpis}. Where client data produced metrics, show the actual value and status.`,
      tier: "template",
    },
    {
      key: "policies",
      title: `${d.name} Policy Manual`,
      guidance: `Write 6–8 policies: ${d.policies}. Each starts with a level-2 heading "POLICY ${p}P-01: <NAME>", followed by numbered clauses: a level-3 heading "${p}P-01.1 <clause title>" then a paragraph, for every clause.`,
      tier: "template",
    },
    {
      key: "checklists",
      title: `${d.name} Governance Checklists`,
      guidance: `5–6 checklists: ${d.checklists}. Each starts with a level-2 heading "CHECKLIST ${p}-01: <NAME>", then a table: # | Checklist item | Responsible | Done (✓) | Date.`,
      tier: "template",
    },
    {
      key: "roadmap",
      title: `Implementation Roadmap — 3-Phase ${d.name} Transformation`,
      guidance: `Phase 1 critical foundations (weeks 1–3), Phase 2 governance & reporting (months 2–3), Phase 3 optimisation (months 4–6), dated from the assessment date. Each phase: numbered actions with owner. Prioritise the client's weakest dimensions. Focus: ${d.roadmapFocus}.`,
      tier: "analysis",
    },
    {
      key: "conclusion",
      title: "Conclusion & Strategic Outlook",
      guidance: `Expected outcomes with measurable targets (${d.outcomes}) and the governance transformation outlook for this client.`,
      tier: "analysis",
    },
  ];
}

/** Turns question definitions into rows with stable sort order (profile questions first). */
export function buildQuestions(d: DepartmentDef) {
  return d.questions.map((q, i) => ({
    code: q.code,
    dimension: q.dimension,
    text: q.text,
    answer_type: q.answer_type ?? "maturity",
    weight: q.answer_type && q.answer_type !== "maturity" ? 0 : (q.weight ?? 1),
    guidance: q.answer_type && q.answer_type !== "maturity" ? "Context only, not scored." : null,
    sort: (i + 1) * 10,
  }));
}
