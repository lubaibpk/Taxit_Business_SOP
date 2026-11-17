"use client";
import Link from "next/link";
import { useState } from "react";
import { createEngagement } from "../../../../actions";
import { SubmitButton } from "@/components/submit-button";

type Dept = { id: string; code: string; name: string; description: string | null; ready: boolean };

const GROUPS: { title: string; codes: string[] }[] = [
  { title: "Sales & customers", codes: ["sales", "credit", "van_sales", "expansion"] },
  { title: "Finance & control", codes: ["finance", "cash", "treasury", "tax"] },
  { title: "Purchasing & operations", codes: ["procurement", "purchase_matching", "fleet"] },
  { title: "People, compliance & leadership", codes: ["hr", "compliance", "governance"] },
];

export function NewAssessmentForm({ clientId, defaultTitle, departments }: { clientId: string; defaultTitle: string; departments: Dept[] }) {
  const ready = departments.filter((d) => d.ready);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const grouped = new Set(GROUPS.flatMap((g) => g.codes));
  const groups = [...GROUPS, { title: "Other", codes: departments.filter((d) => !grouped.has(d.code)).map((d) => d.code) }].filter((g) => g.codes.length);

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={createEngagement} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      {[...picked].map((id) => (
        <input key={id} type="hidden" name="departments" value={id} />
      ))}

      <div className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Title</label>
          <input className="input" name="title" defaultValue={defaultTitle} />
        </div>
        <div>
          <label className="label">Assessment date</label>
          <input className="input" type="date" name="assessment_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>

      <div className="card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">Departments</h2>
            <p className="text-xs text-gray-500">{picked.size} selected</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setPicked(new Set(ready.map((d) => d.id)))}>
              Select all
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setPicked(new Set())}>
              Clear
            </button>
          </div>
        </div>
        {groups.map((g) => (
          <div key={g.title} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{g.title}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.codes
                .map((c) => departments.find((d) => d.code === c))
                .filter((d): d is Dept => !!d)
                .map((d) => {
                  const on = picked.has(d.id);
                  return (
                    <button
                      type="button"
                      key={d.id}
                      disabled={!d.ready}
                      onClick={() => toggle(d.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        on ? "border-brand bg-blue-50/60 ring-1 ring-brand" : "border-gray-200 hover:border-gray-300"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{d.name}</span>
                        <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${on ? "border-brand bg-brand text-white" : "border-gray-300"}`}>{on ? "✓" : ""}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-gray-500">{d.ready ? d.description : "Not available yet"}</div>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Link href={`/clients/${clientId}`} className="btn-secondary">
          Cancel
        </Link>
        {picked.size === 0 ? (
          <button className="btn" disabled>
            Select at least one department
          </button>
        ) : (
          <SubmitButton pendingText="Starting…">Start assessment ({picked.size})</SubmitButton>
        )}
      </div>
    </form>
  );
}
