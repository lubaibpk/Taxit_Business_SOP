"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DepartmentDraft } from "@/lib/ai/design-department";
import { saveCustomDepartment } from "../actions";

const DOC_FIELDS: { key: keyof DepartmentDraft; label: string }[] = [
  { key: "sops", label: "SOPs" },
  { key: "forms", label: "Forms & templates" },
  { key: "registers", label: "Registers & trackers" },
  { key: "kpis", label: "KPIs" },
  { key: "policies", label: "Policies" },
  { key: "checklists", label: "Checklists" },
];

const EXAMPLES = ["Warehouse & Inventory Control", "Kitchen & Food Safety", "Customer Service Centre", "IT & Cybersecurity", "Marketing & Brand", "Quality Control", "Project Management", "E-commerce Operations"];

export function DepartmentDesigner({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [industry, setIndustry] = useState("");
  const [draft, setDraft] = useState<DepartmentDraft | null>(null);
  const [designing, setDesigning] = useState(false);
  const [saving, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function design() {
    setErr(null);
    setDesigning(true);
    try {
      const res = await fetch("/api/departments/design", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, scope, industry }) });
      const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDesigning(false);
    }
  }

  const upd = (p: Partial<DepartmentDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  function save() {
    if (!draft) return;
    setErr(null);
    start(async () => {
      try {
        await saveCustomDepartment(draft);
        router.push(returnTo);
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Department name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warehouse & Inventory Control" />
          </div>
          <div>
            <label className="label">Typical client industry (optional)</label>
            <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Restaurants, Contracting, Clinics" />
          </div>
        </div>
        <div>
          <label className="label">What should it cover? (optional)</label>
          <textarea className="input min-h-16" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. receiving, put-away, stock counts, expiry control, dispatch, warehouse safety" />
        </div>
        {!draft && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50" onClick={() => setName(x)}>
                {x}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button className="btn" onClick={design} disabled={designing || !name.trim()}>
            {designing ? <><span className="spinner" />Designing… (about a minute)</> : draft ? "Redesign with AI" : "Design with AI"}
          </button>
          {designing && <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />}
        </div>
        {err && <p className="text-sm text-red-700">{err}</p>}
      </div>

      {draft && (
        <>
          <section className="card space-y-4">
            <h2 className="font-medium">Department details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Name (English)</label>
                <input className="input" value={draft.name} onChange={(e) => upd({ name: e.target.value })} />
              </div>
              <div>
                <label className="label">Name (Arabic)</label>
                <input className="input" dir="rtl" value={draft.name_ar} onChange={(e) => upd({ name_ar: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Description</label>
                <input className="input" value={draft.description} onChange={(e) => upd({ description: e.target.value })} />
              </div>
              <div>
                <label className="label">Report title</label>
                <input className="input" value={draft.report_title} onChange={(e) => upd({ report_title: e.target.value })} />
              </div>
              <div>
                <label className="label">Code prefix (for SOP / policy numbers)</label>
                <input className="input" value={draft.prefix} maxLength={3} onChange={(e) => upd({ prefix: e.target.value.toUpperCase() })} />
              </div>
            </div>
          </section>

          <section className="card space-y-4">
            <div>
              <h2 className="font-medium">Report outline</h2>
              <p className="text-xs text-gray-500">
                Every report starts with an Executive Summary and a Roles &amp; Accountability section, then these department sections, then SOPs, forms, registers, KPI dashboard, policies, checklists, roadmap and conclusion.
              </p>
            </div>
            {draft.frameworks.map((f, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-gray-200 p-3">
                <div className="flex gap-2">
                  <span className="pt-2 text-xs text-gray-400">{i + 3}.</span>
                  <input className="input font-medium" value={f.title} onChange={(e) => upd({ frameworks: draft.frameworks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  <button className="btn-ghost btn-sm text-red-700" onClick={() => upd({ frameworks: draft.frameworks.filter((_, j) => j !== i) })} title="Remove section">
                    ✕
                  </button>
                </div>
                <textarea className="input min-h-14 text-xs" value={f.guidance} onChange={(e) => upd({ frameworks: draft.frameworks.map((x, j) => (j === i ? { ...x, guidance: e.target.value } : x)) })} placeholder="What this section must contain" />
              </div>
            ))}
            <button className="btn-secondary btn-sm" onClick={() => upd({ frameworks: [...draft.frameworks, { key: `section_${draft.frameworks.length + 1}`, title: "", guidance: "" }] })}>
              + Add section
            </button>
          </section>

          <section className="card space-y-4">
            <div>
              <h2 className="font-medium">Supporting documents</h2>
              <p className="text-xs text-gray-500">The AI writes each of these in full inside the report. Separate items with commas.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {DOC_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="label">{f.label}</label>
                  <textarea className="input min-h-20 text-xs" value={String(draft[f.key] ?? "")} onChange={(e) => upd({ [f.key]: e.target.value } as Partial<DepartmentDraft>)} />
                </div>
              ))}
            </div>
          </section>

          <section className="card space-y-3">
            <div>
              <h2 className="font-medium">Questionnaire ({draft.questions.length})</h2>
              <p className="text-xs text-gray-500">Each statement is rated 0–4. Weight 1 = normal, 1.5 = important, 2 = critical control. &quot;Context&quot; questions are read by the AI but not scored.</p>
            </div>
            <div className="space-y-2">
              {draft.questions.map((q, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-gray-200 p-2 sm:grid-cols-[160px_1fr_90px_110px_auto]">
                  <input className="input text-xs" value={q.dimension} onChange={(e) => upd({ questions: draft.questions.map((x, j) => (j === i ? { ...x, dimension: e.target.value } : x)) })} placeholder="Area" />
                  <input className="input text-xs" value={q.text} onChange={(e) => upd({ questions: draft.questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Good-practice statement" />
                  <select className="input text-xs" value={String(q.weight ?? 1)} onChange={(e) => upd({ questions: draft.questions.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)) })} disabled={q.answer_type === "text"}>
                    <option value="1">Weight 1</option>
                    <option value="1.5">Weight 1.5</option>
                    <option value="2">Weight 2</option>
                  </select>
                  <select className="input text-xs" value={q.answer_type ?? "maturity"} onChange={(e) => upd({ questions: draft.questions.map((x, j) => (j === i ? { ...x, answer_type: e.target.value as "maturity" | "text" } : x)) })}>
                    <option value="maturity">Rated 0–4</option>
                    <option value="text">Context (text)</option>
                  </select>
                  <button className="btn-ghost btn-sm text-red-700" onClick={() => upd({ questions: draft.questions.filter((_, j) => j !== i) })} title="Remove question">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn-secondary btn-sm"
              onClick={() => upd({ questions: [...draft.questions, { code: "", dimension: draft.questions.at(-1)?.dimension ?? "General", text: "", weight: 1, answer_type: "maturity" }] })}
            >
              + Add question
            </button>
          </section>

          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
            <span className="text-sm text-gray-600">
              {draft.frameworks.length + 10} report sections · {draft.questions.length} questions
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setDraft(null)} disabled={saving}>
                Discard
              </button>
              <button className="btn" onClick={save} disabled={saving}>
                {saving ? <><span className="spinner" />Saving…</> : "Save department"}
              </button>
            </div>
          </div>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </>
      )}
    </div>
  );
}
