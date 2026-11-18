"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; code: string; title: string };
type Group = { kind: string; label: string; items: Item[] };
type Tracker = { id: string; code: string; title: string; columns: number; alerts: number };

export function PackView(props: {
  reportId: string;
  approved: boolean;
  groups: Group[];
  trackers: Tracker[];
  hasRegisters: boolean;
  thin: { id: string; title: string; written: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [rewriting, setRewriting] = useState<{ done: number; total: number } | null>(null);
  const base = `/api/reports/${props.reportId}/pack`;
  const docCount = props.groups.reduce((s, g) => s + g.items.length, 0);

  async function run(kind: "trackers" | "jds") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(`${base}/${kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({ error: res.status === 504 ? "This took too long and timed out. Please try again." : `Server error ${res.status}` }));
      if (!res.ok) throw new Error(data.error);
      setMsg({ text: kind === "trackers" ? `Built ${data.count} Excel trackers.` : `Wrote ${data.count} job descriptions.`, ok: true });
      router.refresh();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(null);
    }
  }

  async function rewriteThin() {
    const queue = [...props.thin];
    setRewriting({ done: 0, total: queue.length });
    setMsg(null);
    let failed = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const s = queue.shift()!;
          const res = await fetch(`/api/sections/${s.id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          if (!res.ok) failed++;
          setRewriting((r) => (r ? { ...r, done: r.done + 1 } : r));
        }
      }),
    );
    setRewriting(null);
    setMsg(failed ? { text: `${failed} chapter(s) failed — open the report to retry them.`, ok: false } : { text: "Chapters rewritten. Review and approve them in the report.", ok: true });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {!props.approved && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This report isn&apos;t approved yet, so every file is marked DRAFT. Approve the report to issue final documents.
        </div>
      )}

      {props.thin.length > 0 && (
        <div className="card space-y-3 border-amber-300">
          <div>
            <h2 className="font-medium">Some chapters need rewriting for the pack</h2>
            <p className="text-sm text-gray-600">
              These chapters don&apos;t contain separate, coded items (each SOP, form or policy under its own heading), so they can&apos;t be split into files. This usually means they were written before the pack existed or came out too short.
            </p>
            <ul className="mt-2 list-disc ps-5 text-sm text-gray-700">
              {props.thin.map((s) => (
                <li key={s.id}>
                  {s.title} {!s.written && <span className="text-gray-400">(not written)</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn" onClick={rewriteThin} disabled={!!rewriting}>
              {rewriting ? (
                <>
                  <span className="spinner" />
                  Rewriting… ({rewriting.done}/{rewriting.total})
                </>
              ) : (
                `Rewrite these ${props.thin.length} chapters with AI`
              )}
            </button>
            <span className="text-xs text-gray-500">Takes a few minutes. Rewritten chapters go back to draft for review.</span>
          </div>
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-medium">Download the whole pack</div>
          <div className="text-xs text-gray-500">
            Full report + {docCount} document{docCount === 1 ? "" : "s"} + {props.trackers.length} Excel tracker{props.trackers.length === 1 ? "" : "s"}, in folders.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`${base}/zip?format=docx`}>
            Download .zip (Word)
          </a>
          <a className="btn-secondary" href={`${base}/zip?format=pdf`}>
            Download .zip (PDF)
          </a>
        </div>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Excel trackers</h2>
            <p className="text-xs text-gray-500">Working spreadsheets with dropdowns, date checks, formulas, totals and colour alerts, designed from the report&apos;s Registers chapter.</p>
          </div>
          <button className={props.trackers.length ? "btn-secondary btn-sm" : "btn btn-sm"} onClick={() => run("trackers")} disabled={!!busy || !props.hasRegisters}>
            {busy === "trackers" ? (
              <>
                <span className="spinner" />
                Designing trackers…
              </>
            ) : props.trackers.length ? (
              "Redesign trackers"
            ) : (
              "Build Excel trackers with AI"
            )}
          </button>
        </div>
        {!props.hasRegisters && <p className="text-sm text-gray-500">Write the report&apos;s Registers chapter first.</p>}
        {props.trackers.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {props.trackers.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  <span className="mr-2 text-xs text-gray-400">{t.code}</span>
                  {t.title}
                  <span className="ml-2 text-xs text-gray-400">
                    {t.columns} columns · {t.alerts} alerts
                  </span>
                </span>
                <a className="btn-ghost btn-sm text-green-800" href={`${base}/file?item=${t.id}`}>
                  Excel ↓
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {props.groups.map((g) =>
        g.kind === "jd" ? (
          <section key={g.kind} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">Job descriptions</h2>
                <p className="text-xs text-gray-500">One per key role in this department, using your client&apos;s people and the report&apos;s controls and limits.</p>
              </div>
              <button className={g.items.length ? "btn-secondary btn-sm" : "btn btn-sm"} onClick={() => run("jds")} disabled={!!busy}>
                {busy === "jds" ? (
                  <>
                    <span className="spinner" />
                    Writing JDs…
                  </>
                ) : g.items.length ? (
                  "Rewrite JDs"
                ) : (
                  "Write job descriptions with AI"
                )}
              </button>
            </div>
            <ItemList items={g.items} base={base} />
          </section>
        ) : g.items.length ? (
          <section key={g.kind} className="card space-y-2">
            <h2 className="font-medium">
              {g.label} <span className="text-sm font-normal text-gray-400">({g.items.length})</span>
            </h2>
            {g.kind === "register" && <p className="text-xs text-gray-500">Written specifications of each register. The Excel trackers above are the working versions.</p>}
            <ItemList items={g.items} base={base} />
          </section>
        ) : null,
      )}

      <div className="text-sm">
        <Link href={`/reports/${props.reportId}`} className="text-brand hover:underline">
          ← Back to the report
        </Link>
      </div>
    </div>
  );
}

function ItemList({ items, base }: { items: Item[]; base: string }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="min-w-0 text-sm">
            <span className="mr-2 text-xs text-gray-400">{d.code}</span>
            {d.title}
          </span>
          <span className="flex gap-1">
            <a className="btn-ghost btn-sm text-blue-800" href={`${base}/file?item=${d.id}&format=docx`}>
              Word ↓
            </a>
            <a className="btn-ghost btn-sm text-red-800" href={`${base}/file?item=${d.id}&format=pdf`}>
              PDF ↓
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
