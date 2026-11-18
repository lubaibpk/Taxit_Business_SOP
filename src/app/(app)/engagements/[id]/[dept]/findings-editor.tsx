"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFindings } from "../../../actions";

const TEMPLATE = `What we observed (site visits, interviews, document review):
-

Key problems and their impact:
-

What management wants to achieve:
-

Specific facts, names and figures to use (people, systems, limits, amounts):
-

Must include / must avoid in the report:
- `;

export function FindingsEditor({
  engagementId,
  departmentId,
  initial,
  updatedAt,
  nextHref,
}: {
  engagementId: string;
  departmentId: string;
  initial: string;
  updatedAt: string | null;
  nextHref: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  function save(goNext: boolean) {
    setMsg(null);
    start(async () => {
      try {
        await saveFindings(engagementId, departmentId, text);
        setDirty(false);
        if (goNext) router.push(nextHref);
        else {
          setMsg({ text: "Saved", ok: true });
          router.refresh();
        }
      } catch (e) {
        setMsg({ text: (e as Error).message, ok: false });
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-medium">Your findings & notes</h2>
            <p className="text-sm text-gray-500">
              Write what you found in your own words — observations, problems, what the owners want, names, figures, anything specific. The AI treats this as the most important input and builds every section of the report around it. Notes can be in English or Arabic.
            </p>
          </div>
          {!text.trim() && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setText(TEMPLATE);
                setDirty(true);
              }}
            >
              Use a guided template
            </button>
          )}
        </div>
        <textarea
          className="input min-h-[24rem] text-sm leading-relaxed"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          placeholder={"e.g.\n- Credit is given by salesmen on WhatsApp approval from Mansoor; no written limits.\n- 145 customers are over 90 days; the top 3 overdue are construction contractors.\n- Owners want DSO under 45 days by Q2 and a weekly collection meeting every Sunday.\n- Use SAR 50,000 as the first approval band. Don't recommend new hires this year."}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            {text.trim() ? `${text.trim().split(/\s+/).length} words` : "No notes yet — optional, but they make the report far more specific."}
            {updatedAt && !dirty && ` · last saved ${new Date(updatedAt).toLocaleString()}`}
            {dirty && <span className="ml-1 text-amber-700">· unsaved changes</span>}
            {msg && <span className={`ml-1 ${msg.ok ? "text-green-700" : "text-red-700"}`}>· {msg.text}</span>}
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => save(false)} disabled={saving}>
              Save
            </button>
            <button className="btn" onClick={() => save(true)} disabled={saving}>
              {saving ? <><span className="spinner" />Saving…</> : "Save & continue →"}
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Tip: after the report is written you can still steer individual sections with &quot;Revise with AI&quot;. Changing these notes affects sections written or rewritten afterwards.
      </p>
    </section>
  );
}
