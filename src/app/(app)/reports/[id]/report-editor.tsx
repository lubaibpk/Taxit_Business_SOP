"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blocksToText, type Block } from "@/lib/blocks";
import { addComment, saveSectionText, setReportStatus, setSectionStatus } from "../../actions";
import { BlockView } from "@/components/block-view";

type Section = {
  id: string;
  key: string;
  title: string;
  sort: number;
  content: { blocks: Block[] } | null;
  status: "empty" | "generating" | "draft" | "in_review" | "approved" | "error";
  error: string | null;
};
type Comment = { id: string; section_id: string; body: string; created_at: string; profiles: { full_name: string | null; email: string } | null };

const STATUS_STYLE: Record<Section["status"], string> = {
  empty: "bg-gray-100 text-gray-600",
  generating: "bg-blue-100 text-blue-800",
  draft: "bg-amber-100 text-amber-800",
  in_review: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

export function ReportEditor(props: {
  reportId: string;
  reportStatus: "draft" | "in_review" | "approved";
  language: "en" | "ar";
  canApprove: boolean;
  initialSections: Section[];
  comments: Comment[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(props.initialSections);
  const [openId, setOpenId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const patch = (id: string, p: Partial<Section>) => setSections((ss) => ss.map((s) => (s.id === id ? { ...s, ...p } : s)));

  async function generate(id: string, instructions?: string, revise = false) {
    patch(id, { status: "generating", error: null });
    try {
      const res = await fetch(`/api/sections/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions, revise }),
      });
      const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok) throw new Error(data.error);
      patch(id, { status: "draft", content: { blocks: data.blocks }, error: null });
    } catch (e) {
      setSections((ss) => ss.map((s) => (s.id === id ? { ...s, status: s.content?.blocks?.length ? "draft" : "error", error: (e as Error).message } : s)));
    }
  }

  async function generateMissing() {
    setRunning(true);
    setMsg(null);
    const queue = sections.filter((s) => !s.content?.blocks?.length).map((s) => s.id);
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length) await generate(queue.shift()!);
    });
    await Promise.all(workers);
    setRunning(false);
    router.refresh();
  }

  const done = sections.filter((s) => s.content?.blocks?.length).length;
  const approved = sections.filter((s) => s.status === "approved").length;

  function changeReportStatus(status: "draft" | "in_review" | "approved") {
    setMsg(null);
    start(async () => {
      try {
        await setReportStatus(props.reportId, status);
        router.refresh();
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <div>
            Report status: <strong className="capitalize">{props.reportStatus.replace("_", " ")}</strong>
          </div>
          <div className="text-gray-500">
            {done} of {sections.length} sections written · {approved} approved
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {done < sections.length && (
            <button className="btn" onClick={generateMissing} disabled={running}>
              {running ? "Writing sections…" : done ? "Write remaining sections" : "Write all sections with AI"}
            </button>
          )}
          {props.reportStatus === "draft" && done === sections.length && (
            <button className="btn-secondary" onClick={() => changeReportStatus("in_review")} disabled={pending}>
              Submit for review
            </button>
          )}
          {props.canApprove && props.reportStatus !== "approved" && (
            <button className="btn-secondary" onClick={() => changeReportStatus("approved")} disabled={pending || approved < sections.length}>
              Approve report
            </button>
          )}
          {props.reportStatus === "approved" && (
            <button className="btn-secondary" onClick={() => changeReportStatus("in_review")} disabled={pending}>
              Reopen
            </button>
          )}
          <a className="btn-secondary" href={`/api/reports/${props.reportId}/export`}>
            {props.reportStatus === "approved" ? "Download Word file" : "Download draft (.docx)"}
          </a>
        </div>
      </div>
      {msg && <p className="text-sm text-red-700">{msg}</p>}

      <div className="space-y-2">
        {sections.map((s) => (
          <SectionCard
            key={s.id}
            section={s}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            rtl={props.language === "ar"}
            canApprove={props.canApprove}
            comments={props.comments.filter((c) => c.section_id === s.id)}
            onGenerate={(instr, revise) => generate(s.id, instr, revise)}
            onPatch={(p) => patch(s.id, p)}
          />
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  section: s,
  open,
  onToggle,
  rtl,
  canApprove,
  comments,
  onGenerate,
  onPatch,
}: {
  section: Section;
  open: boolean;
  onToggle: () => void;
  rtl: boolean;
  canApprove: boolean;
  comments: Comment[];
  onGenerate: (instructions?: string, revise?: boolean) => Promise<void>;
  onPatch: (p: Partial<Section>) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [comment, setComment] = useState("");
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const blocks = s.content?.blocks ?? [];

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setErr(null);
      try {
        await fn();
      } catch (e) {
        setErr((e as Error).message);
      }
    });

  return (
    <div className="card p-0">
      <button className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left" onClick={onToggle}>
        <span className="font-medium">
          <span className="mr-2 text-gray-400">{s.sort}.</span>
          {s.title}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[s.status]}`}>{s.status.replace("_", " ")}</span>
      </button>
      {s.error && <p className="px-5 pb-2 text-sm text-red-700">{s.error}</p>}
      {open && (
        <div className="space-y-4 border-t border-gray-100 px-5 py-4">
          {s.status === "generating" ? (
            <p className="text-sm text-gray-500">Writing this section… long sections can take a few minutes.</p>
          ) : editing ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Format: <code>## Heading</code>, <code>### Subheading</code>, <code>- bullet</code>, <code>1. numbered</code>, tables as <code>| a | b |</code> lines (first row is the header), boxed list as <code>!! Title</code> followed by <code>- items</code>. Leave a blank line between blocks.
              </p>
              <textarea className="input min-h-[28rem] font-mono text-xs" dir={rtl ? "rtl" : "ltr"} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="flex gap-2">
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const r = await saveSectionText(s.id, text);
                      onPatch({ content: { blocks: r.blocks }, status: "draft" });
                      setEditing(false);
                    })
                  }
                >
                  Save edits
                </button>
                <button className="btn-secondary" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : blocks.length ? (
            <div dir={rtl ? "rtl" : "ltr"} className="max-h-[36rem] overflow-y-auto rounded-md border border-gray-100 p-4">
              <BlockView blocks={blocks} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not written yet.</p>
          )}

          {!editing && s.status !== "generating" && (
            <div className="flex flex-wrap gap-2">
              {blocks.length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setText(blocksToText(blocks));
                    setEditing(true);
                  }}
                >
                  Edit text
                </button>
              )}
              {blocks.length > 0 && s.status !== "in_review" && s.status !== "approved" && (
                <button className="btn-secondary" disabled={busy} onClick={() => run(async () => { await setSectionStatus(s.id, "in_review"); onPatch({ status: "in_review" }); })}>
                  Mark ready for review
                </button>
              )}
              {canApprove && blocks.length > 0 && s.status !== "approved" && (
                <button className="btn-secondary" disabled={busy} onClick={() => run(async () => { await setSectionStatus(s.id, "approved"); onPatch({ status: "approved" }); })}>
                  Approve section
                </button>
              )}
              {s.status === "approved" && (
                <button className="btn-secondary" disabled={busy} onClick={() => run(async () => { await setSectionStatus(s.id, "draft"); onPatch({ status: "draft" }); })}>
                  Unapprove
                </button>
              )}
            </div>
          )}

          {!editing && s.status !== "generating" && (
            <div className="space-y-2 rounded-md bg-gray-50 p-3">
              <label className="label">{blocks.length ? "Rewrite with AI — tell it what to change" : "Write this section with AI — optional instructions"}</label>
              <textarea
                className="input min-h-16"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Use a SAR 50,000 limit for the first approval band; add a step for Najiz enforcement; shorten to one page"
              />
              <div className="flex flex-wrap gap-2">
                {blocks.length > 0 && (
                  <button className="btn-secondary" onClick={() => onGenerate(instructions || undefined, true)}>
                    Revise current draft
                  </button>
                )}
                <button className="btn-secondary" onClick={() => onGenerate(instructions || undefined, false)}>
                  {blocks.length ? "Rewrite from scratch" : "Write section"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500">Review comments</div>
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <span className="font-medium">{c.profiles?.full_name || c.profiles?.email}</span>: {c.body}
              </div>
            ))}
            <div className="flex gap-2">
              <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment for the team" />
              <button
                className="btn-secondary"
                disabled={busy || !comment.trim()}
                onClick={() =>
                  run(async () => {
                    await addComment(s.id, comment);
                    setComment("");
                    router.refresh();
                  })
                }
              >
                Add
              </button>
            </div>
          </div>
          {err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      )}
    </div>
  );
}
