"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blocksToText, type Block } from "@/lib/blocks";
import { addComment, saveSectionText, setReportStatus, setSectionStatus } from "../../actions";
import { BlockView } from "@/components/block-view";
import { Progress } from "@/components/ui";

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

const DOT: Record<Section["status"], string> = {
  empty: "bg-gray-300",
  generating: "bg-blue-500 animate-pulse",
  draft: "bg-amber-400",
  in_review: "bg-purple-500",
  approved: "bg-green-600",
  error: "bg-red-600",
};
const LABEL: Record<Section["status"], string> = {
  empty: "Not written",
  generating: "Writing…",
  draft: "Draft",
  in_review: "Ready for review",
  approved: "Approved",
  error: "Error",
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
  const [selected, setSelected] = useState(props.initialSections.find((s) => s.status !== "approved")?.id ?? props.initialSections[0]?.id);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => exportRef.current && !exportRef.current.contains(e.target as Node) && setExportOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const patch = (id: string, p: Partial<Section>) => setSections((ss) => ss.map((s) => (s.id === id ? { ...s, ...p } : s)));

  async function generate(id: string, instructions?: string, revise = false) {
    patch(id, { status: "generating", error: null });
    try {
      const res = await fetch(`/api/sections/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions, revise }),
      });
      const data = await res.json().catch(() => ({ error: res.status === 504 ? "The section took too long and timed out. Try again, or ask for a shorter version." : `Server error ${res.status}` }));
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
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) await generate(queue.shift()!);
      }),
    );
    setRunning(false);
    router.refresh();
  }

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

  const written = sections.filter((s) => s.content?.blocks?.length).length;
  const approved = sections.filter((s) => s.status === "approved").length;
  const total = sections.length;
  const idx = sections.findIndex((s) => s.id === selected);
  const current = sections[idx];
  const goNextUnapproved = () => {
    const next = sections.slice(idx + 1).find((s) => s.status !== "approved") ?? sections.find((s) => s.status !== "approved" && s.id !== selected);
    if (next) setSelected(next.id);
  };

  // what the user should do next, shown as the primary action
  let primary: React.ReactNode = null;
  if (written < total)
    primary = (
      <button className="btn" onClick={generateMissing} disabled={running}>
        {running ? `Writing sections… (${written}/${total})` : written ? `Write remaining ${total - written} sections` : "Write all sections with AI"}
      </button>
    );
  else if (props.reportStatus === "draft")
    primary = (
      <button className="btn" onClick={() => changeReportStatus("in_review")} disabled={pending}>
        Submit for review
      </button>
    );
  else if (props.reportStatus === "in_review" && props.canApprove)
    primary = (
      <button className="btn" onClick={() => changeReportStatus("approved")} disabled={pending || approved < total} title={approved < total ? "Approve every section first" : undefined}>
        {approved < total ? `Approve sections first (${approved}/${total})` : "Approve report"}
      </button>
    );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-56 flex-1 space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              {written}/{total} written · {approved}/{total} approved
            </span>
            <span className="capitalize">Report: {props.reportStatus.replace("_", " ")}</span>
          </div>
          <Progress value={written + approved} max={total * 2} tone={props.reportStatus === "approved" ? "green" : "brand"} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primary}
          {props.reportStatus === "approved" && (
            <button className="btn-secondary" onClick={() => changeReportStatus("in_review")} disabled={pending}>
              Reopen for edits
            </button>
          )}
          <div className="relative" ref={exportRef}>
            <button className={props.reportStatus === "approved" ? "btn" : "btn-secondary"} onClick={() => setExportOpen((o) => !o)}>
              {props.reportStatus === "approved" ? "Download" : "Download draft"} ▾
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <a className="block px-4 py-2 text-sm hover:bg-gray-50" href={`/api/reports/${props.reportId}/export`} onClick={() => setExportOpen(false)}>
                  Word document (.docx)
                  <span className="block text-[11px] text-gray-500">Editable</span>
                </a>
                <a className="block px-4 py-2 text-sm hover:bg-gray-50" href={`/api/reports/${props.reportId}/pdf`} onClick={() => setExportOpen(false)}>
                  PDF document (.pdf)
                  <span className="block text-[11px] text-gray-500">Ready to send · takes a few seconds</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      {msg && <p className="text-sm text-red-700">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <nav className="card max-h-[calc(100vh-14rem)] overflow-y-auto p-2 lg:sticky lg:top-20">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${s.id === selected ? "bg-blue-50 text-brand" : "hover:bg-gray-50"}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[s.status]}`} title={LABEL[s.status]} />
              <span className="min-w-0">
                <span className="mr-1 text-gray-400">{s.sort}.</span>
                <span className="line-clamp-2">{s.title}</span>
              </span>
            </button>
          ))}
        </nav>

        {current && (
          <SectionPanel
            key={current.id}
            section={current}
            index={idx}
            total={total}
            rtl={props.language === "ar"}
            canApprove={props.canApprove}
            comments={props.comments.filter((c) => c.section_id === current.id)}
            onGenerate={(instr, revise) => generate(current.id, instr, revise)}
            onPatch={(p) => patch(current.id, p)}
            onPrev={() => idx > 0 && setSelected(sections[idx - 1].id)}
            onNext={() => idx < total - 1 && setSelected(sections[idx + 1].id)}
            onApproved={goNextUnapproved}
          />
        )}
      </div>
    </div>
  );
}

function SectionPanel({
  section: s,
  index,
  total,
  rtl,
  canApprove,
  comments,
  onGenerate,
  onPatch,
  onPrev,
  onNext,
  onApproved,
}: {
  section: Section;
  index: number;
  total: number;
  rtl: boolean;
  canApprove: boolean;
  comments: Comment[];
  onGenerate: (instructions?: string, revise?: boolean) => Promise<void>;
  onPatch: (p: Partial<Section>) => void;
  onPrev: () => void;
  onNext: () => void;
  onApproved: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "ai">("view");
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
    <div className="card space-y-4 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">
            Section {index + 1} of {total} · {LABEL[s.status]}
          </div>
          <h2 className="font-semibold">{s.title}</h2>
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost btn-sm" onClick={onPrev} disabled={index === 0}>
            ← Prev
          </button>
          <button className="btn-ghost btn-sm" onClick={onNext} disabled={index === total - 1}>
            Next →
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 pb-5">
        {s.error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{s.error}</div>}

        {s.status === "generating" ? (
          <div className="flex items-center gap-3 py-10 text-sm text-gray-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand" />
            Writing this section… long sections can take a few minutes. You can keep working on other sections.
          </div>
        ) : mode === "edit" ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              <code>## Heading</code> · <code>### Subheading</code> · <code>- bullet</code> · <code>1. numbered</code> · tables as <code>| a | b |</code> lines (first row = header) · boxed list: <code>!! Title</code> then <code>- items</code>. Blank line between blocks.
            </p>
            <textarea className="input min-h-[32rem] font-mono text-xs" dir={rtl ? "rtl" : "ltr"} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex gap-2">
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await saveSectionText(s.id, text);
                    onPatch({ content: { blocks: r.blocks }, status: "draft" });
                    setMode("view");
                  })
                }
              >
                Save edits
              </button>
              <button className="btn-secondary" onClick={() => setMode("view")}>
                Cancel
              </button>
            </div>
          </div>
        ) : blocks.length ? (
          <div dir={rtl ? "rtl" : "ltr"} className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-100 p-5">
            <BlockView blocks={blocks} />
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-5">
            <div className="text-sm text-gray-600">
              This section hasn&apos;t been written yet. Add your own points for it (optional) — the AI will build the section around them, together with your department findings.
            </div>
            <textarea
              className="input min-h-28"
              dir={rtl ? "rtl" : "ltr"}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={"e.g.\n- Approval bands: up to SAR 50,000 Credit Controller, above that Mansoor\n- Mention the weekly Sunday collection meeting\n- Keep it to one page"}
            />
            <button className="btn" onClick={() => onGenerate(instructions || undefined, false)}>
              Write this section with AI
            </button>
          </div>
        )}

        {mode === "ai" && s.status !== "generating" && (
          <div className="space-y-2 rounded-lg bg-gray-50 p-3">
            <label className="label">Tell the AI what to change</label>
            <textarea
              className="input min-h-20"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Use SAR 50,000 for the first approval band; add a Najiz enforcement step; shorten to one page"
            />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-sm" disabled={!instructions.trim()} onClick={() => { onGenerate(instructions, true); setMode("view"); }}>
                Revise this draft
              </button>
              <button className="btn-secondary btn-sm" onClick={() => { onGenerate(instructions || undefined, false); setMode("view"); }}>
                Rewrite from scratch
              </button>
              <button className="btn-ghost btn-sm" onClick={() => setMode("view")}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === "view" && s.status !== "generating" && blocks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {canApprove && s.status !== "approved" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await setSectionStatus(s.id, "approved");
                    onPatch({ status: "approved" });
                    onApproved();
                  })
                }
              >
                ✓ Approve & next
              </button>
            )}
            {!canApprove && s.status !== "in_review" && s.status !== "approved" && (
              <button className="btn" disabled={busy} onClick={() => run(async () => { await setSectionStatus(s.id, "in_review"); onPatch({ status: "in_review" }); onApproved(); })}>
                Mark ready for review & next
              </button>
            )}
            <button className="btn-secondary" onClick={() => setMode("ai")}>
              Revise with AI
            </button>
            <button className="btn-secondary" onClick={() => { setText(blocksToText(blocks)); setMode("edit"); }}>
              Edit text
            </button>
            {s.status === "approved" && (
              <button className="btn-ghost" disabled={busy} onClick={() => run(async () => { await setSectionStatus(s.id, "draft"); onPatch({ status: "draft" }); })}>
                Unapprove
              </button>
            )}
          </div>
        )}

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="text-xs font-medium text-gray-500">Review comments ({comments.length})</div>
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="font-medium">{c.profiles?.full_name || c.profiles?.email}</span>
              <span className="ml-2 text-[11px] text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
              <div>{c.body}</div>
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
    </div>
  );
}
