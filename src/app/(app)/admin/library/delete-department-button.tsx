"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomDepartment } from "./actions";

export function DeleteDepartmentButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      className="btn-ghost btn-sm text-red-700 hover:bg-red-50"
      disabled={busy}
      onClick={() => {
        if (!confirm(`Delete the "${name}" department and its questionnaire?`)) return;
        start(async () => {
          try {
            await deleteCustomDepartment(id);
            router.refresh();
          } catch (e) {
            alert((e as Error).message);
          }
        });
      }}
    >
      {busy ? <><span className="spinner" />Deleting…</> : "Delete"}
    </button>
  );
}
