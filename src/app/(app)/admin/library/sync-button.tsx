"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncDepartmentLibrary } from "./actions";

export function SyncButton() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-sm text-gray-600">{msg}</span>}
      <button
        className="btn"
        disabled={busy}
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              const r = await syncDepartmentLibrary();
              setMsg(`Loaded ${r.length} departments, ${r.reduce((s, x) => s + x.questions, 0)} questions.`);
              router.refresh();
            } catch (e) {
              setMsg((e as Error).message);
            }
          })
        }
      >
        {busy ? "Loading…" : "Load / update library"}
      </button>
    </div>
  );
}
