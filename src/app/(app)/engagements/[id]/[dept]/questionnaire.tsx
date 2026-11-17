"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MATURITY_LEVELS } from "@/lib/scoring";
import { saveResponses } from "../../../actions";

type Question = { id: string; code: string; dimension: string; text: string; answer_type: string; guidance: string | null };
type Response = { question_id: string; source: "consultant" | "client"; value: unknown; comment: string | null; respondent: string | null };
type Answer = { value: unknown; comment: string };

const isSet = (v: unknown) => v !== undefined && v !== null && v !== "";
const slug = (s: string) => "dim-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function Questionnaire({
  engagementId,
  departmentId,
  questions,
  responses,
  nextHref,
}: {
  engagementId: string;
  departmentId: string;
  questions: Question[];
  responses: Response[];
  nextHref: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState<"consultant" | "client">("consultant");
  const [respondent, setRespondent] = useState(() => responses.find((r) => r.source === "client" && r.respondent)?.respondent ?? "");
  const [saving, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const initial = useMemo(() => {
    const m: Record<string, Record<string, Answer>> = { consultant: {}, client: {} };
    for (const r of responses) m[r.source][r.question_id] = { value: r.value, comment: r.comment ?? "" };
    return m;
  }, [responses]);
  const [answers, setAnswers] = useState(initial);
  const current = answers[source];
  const other = answers[source === "consultant" ? "client" : "consultant"];

  const set = (qid: string, patch: Partial<Answer>) => {
    setDirty(true);
    setAnswers((a) => {
      const prev = a[source][qid] ?? { value: null, comment: "" };
      return { ...a, [source]: { ...a[source], [qid]: { ...prev, ...patch } } };
    });
  };

  const dims = [...new Set(questions.map((q) => q.dimension))];
  const answeredIn = (d: string) => questions.filter((q) => q.dimension === d && isSet(current[q.id]?.value)).length;
  const answeredCount = questions.filter((q) => isSet(current[q.id]?.value)).length;

  function save(goNext: boolean) {
    setMsg(null);
    start(async () => {
      try {
        await saveResponses(
          engagementId,
          departmentId,
          source,
          source === "client" ? respondent || null : null,
          questions.map((q) => ({ question_id: q.id, value: current[q.id]?.value ?? null, comment: current[q.id]?.comment || null })),
        );
        setDirty(false);
        if (goNext) router.push(nextHref);
        else {
          setMsg({ text: "Saved and rescored", ok: true });
          router.refresh();
        }
      } catch (e) {
        setMsg({ text: (e as Error).message, ok: false });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card space-y-3 p-4">
          <div>
            <label className="label">Answers given by</label>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value as "consultant" | "client")}>
              <option value="consultant">Consultant (verified)</option>
              <option value="client">Client (self-assessment)</option>
            </select>
          </div>
          {source === "client" && (
            <div>
              <label className="label">Client respondent</label>
              <input className="input" value={respondent} onChange={(e) => { setRespondent(e.target.value); setDirty(true); }} placeholder="Name, position" />
            </div>
          )}
          <p className="text-[11px] text-gray-500">Where both exist, the consultant&apos;s answer is used for scoring.</p>
        </div>
        <nav className="card space-y-0.5 p-2 text-sm">
          {dims.map((d) => {
            const total = questions.filter((q) => q.dimension === d).length;
            const n = answeredIn(d);
            return (
              <a key={d} href={`#${slug(d)}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                <span className="truncate text-gray-700">{d}</span>
                <span className={`text-xs ${n === total ? "text-green-700" : "text-gray-400"}`}>
                  {n === total ? "✓" : `${n}/${total}`}
                </span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="space-y-6">
        <div className="rounded-lg bg-white px-4 py-3 text-xs text-gray-600 ring-1 ring-gray-200">
          <span className="font-medium text-gray-800">How to answer:</span> rate how well each practice works today —{" "}
          {MATURITY_LEVELS.map((l) => `${l.value} ${l.label.toLowerCase()}`).join(" · ")}. Add evidence where you can; the AI uses it.
        </div>

        {dims.map((d) => (
          <section key={d} id={slug(d)} className="scroll-mt-24 space-y-3">
            <h3 className="section-title">{d}</h3>
            {questions
              .filter((q) => q.dimension === d)
              .map((q) => {
                const a = current[q.id];
                const o = other[q.id];
                const showComment = openComments.has(q.id) || !!a?.comment;
                return (
                  <div key={q.id} className={`card space-y-3 p-4 ${isSet(a?.value) ? "" : "border-l-4 border-l-amber-300"}`}>
                    <div className="flex gap-3 text-sm">
                      <span className="shrink-0 pt-0.5 text-[11px] text-gray-400">{q.code}</span>
                      <span>{q.text}</span>
                    </div>
                    {q.answer_type === "maturity" && (
                      <div className="grid grid-cols-5 gap-1.5">
                        {MATURITY_LEVELS.map((l) => {
                          const on = a?.value === l.value;
                          return (
                            <button
                              key={l.value}
                              type="button"
                              onClick={() => set(q.id, { value: on ? null : l.value })}
                              className={`rounded-lg border px-2 py-2 text-center transition ${on ? "border-brand bg-brand text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"}`}
                            >
                              <div className="text-sm font-semibold">{l.value}</div>
                              <div className={`text-[10px] leading-tight ${on ? "text-blue-100" : "text-gray-500"}`}>{l.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {q.answer_type === "yes_no" && (
                      <div className="flex gap-2">
                        {[true, false].map((v) => (
                          <button key={String(v)} type="button" onClick={() => set(q.id, { value: a?.value === v ? null : v })} className={`rounded-lg border px-4 py-1.5 text-sm ${a?.value === v ? "border-brand bg-brand text-white" : "border-gray-200"}`}>
                            {v ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    )}
                    {q.answer_type === "number" && (
                      <input className="input max-w-60" type="number" value={(a?.value as number | undefined) ?? ""} onChange={(e) => set(q.id, { value: e.target.value === "" ? null : Number(e.target.value) })} />
                    )}
                    {q.answer_type === "text" && <textarea className="input min-h-20" value={(a?.value as string | undefined) ?? ""} onChange={(e) => set(q.id, { value: e.target.value })} />}

                    {showComment ? (
                      <input className="input text-xs" autoFocus={!a?.comment} placeholder="Evidence / comment" value={a?.comment ?? ""} onChange={(e) => set(q.id, { comment: e.target.value })} />
                    ) : (
                      <button type="button" className="text-xs text-brand hover:underline" onClick={() => setOpenComments((s) => new Set(s).add(q.id))}>
                        + Add evidence or comment
                      </button>
                    )}
                    {o && isSet(o.value) && (
                      <div className="rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
                        {source === "consultant" ? "Client said" : "Consultant said"}: {q.answer_type === "maturity" ? `${o.value} · ${MATURITY_LEVELS[o.value as number]?.label}` : String(o.value)}
                        {o.comment ? ` — ${o.comment}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
          </section>
        ))}

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="text-sm text-gray-600">
            {answeredCount} of {questions.length} answered
            {dirty && <span className="ml-2 text-amber-700">· unsaved changes</span>}
            {msg && <span className={`ml-2 ${msg.ok ? "text-green-700" : "text-red-700"}`}>· {msg.text}</span>}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => save(false)} disabled={saving}>
              Save
            </button>
            <button className="btn" onClick={() => save(true)} disabled={saving}>
              {saving ? "Saving…" : "Save & continue →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
