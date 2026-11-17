"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MATURITY_LEVELS } from "@/lib/scoring";
import { saveResponses } from "../../../actions";

type Question = { id: string; code: string; dimension: string; text: string; answer_type: string; guidance: string | null };
type Response = { question_id: string; source: "consultant" | "client"; value: unknown; comment: string | null; respondent: string | null };

export function Questionnaire({
  engagementId,
  departmentId,
  questions,
  responses,
}: {
  engagementId: string;
  departmentId: string;
  questions: Question[];
  responses: Response[];
}) {
  const router = useRouter();
  const [source, setSource] = useState<"consultant" | "client">("consultant");
  const [respondent, setRespondent] = useState("");
  const [saving, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const initial = useMemo(() => {
    const m: Record<string, Record<string, { value: unknown; comment: string }>> = { consultant: {}, client: {} };
    for (const r of responses) m[r.source][r.question_id] = { value: r.value, comment: r.comment ?? "" };
    return m;
  }, [responses]);
  const [answers, setAnswers] = useState(initial);
  const current = answers[source];
  const other = answers[source === "consultant" ? "client" : "consultant"];

  const set = (qid: string, patch: Partial<{ value: unknown; comment: string }>) =>
    setAnswers((a) => {
      const prev = a[source][qid] ?? { value: null, comment: "" };
      return { ...a, [source]: { ...a[source], [qid]: { ...prev, ...patch } } };
    });

  const dims = [...new Set(questions.map((q) => q.dimension))];
  const answeredCount = questions.filter((q) => current[q.id]?.value !== undefined && current[q.id]?.value !== null && current[q.id]?.value !== "").length;

  function save() {
    setMsg(null);
    start(async () => {
      try {
        await saveResponses(
          engagementId,
          departmentId,
          source,
          respondent || null,
          questions.map((q) => ({ question_id: q.id, value: current[q.id]?.value ?? null, comment: current[q.id]?.comment || null })),
        );
        setMsg("Saved");
        router.refresh();
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">Questionnaire</h2>
          <p className="text-sm text-gray-500">
            {answeredCount} of {questions.length} answered. Where both exist, the consultant&apos;s answer is used for scoring.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
              <input className="input" value={respondent} onChange={(e) => setRespondent(e.target.value)} placeholder="Name, position" />
            </div>
          )}
        </div>
      </div>

      {dims.map((d) => (
        <div key={d} className="space-y-3">
          <h3 className="border-b border-gray-100 pb-1 text-sm font-semibold text-[#1F3864]">{d}</h3>
          {questions
            .filter((q) => q.dimension === d)
            .map((q) => {
              const a = current[q.id];
              const o = other[q.id];
              return (
                <div key={q.id} className="space-y-2">
                  <div className="text-sm">
                    <span className="mr-2 text-xs text-gray-400">{q.code}</span>
                    {q.text}
                  </div>
                  {q.answer_type === "maturity" && (
                    <div className="flex flex-wrap gap-1.5">
                      {MATURITY_LEVELS.map((l) => (
                        <button
                          key={l.value}
                          type="button"
                          onClick={() => set(q.id, { value: a?.value === l.value ? null : l.value })}
                          className={`rounded-md border px-2.5 py-1 text-xs ${
                            a?.value === l.value ? "border-[#1F3864] bg-[#1F3864] text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {l.value} · {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.answer_type === "yes_no" && (
                    <select className="input max-w-40" value={a?.value === true ? "yes" : a?.value === false ? "no" : ""} onChange={(e) => set(q.id, { value: e.target.value === "" ? null : e.target.value === "yes" })}>
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  )}
                  {q.answer_type === "number" && (
                    <input className="input max-w-60" type="number" value={(a?.value as number | undefined) ?? ""} onChange={(e) => set(q.id, { value: e.target.value === "" ? null : Number(e.target.value) })} />
                  )}
                  {q.answer_type === "text" && (
                    <textarea className="input min-h-16" value={(a?.value as string | undefined) ?? ""} onChange={(e) => set(q.id, { value: e.target.value })} />
                  )}
                  <input
                    className="input text-xs"
                    placeholder="Evidence / comment (optional)"
                    value={a?.comment ?? ""}
                    onChange={(e) => set(q.id, { comment: e.target.value })}
                  />
                  {o && o.value !== null && o.value !== undefined && (
                    <div className="text-xs text-gray-500">
                      {source === "consultant" ? "Client said" : "Consultant said"}: {q.answer_type === "maturity" ? `${o.value} · ${MATURITY_LEVELS[o.value as number]?.label}` : String(o.value)}
                      {o.comment ? ` — ${o.comment}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ))}

      <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center gap-3 border-t border-gray-200 bg-white px-5 py-3">
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save answers & rescore"}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </section>
  );
}
