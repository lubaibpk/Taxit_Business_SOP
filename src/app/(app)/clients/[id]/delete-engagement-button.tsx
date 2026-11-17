"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEngagement } from "../../actions";

/** Deletes an assessment that has no reports yet (e.g. one started by mistake). */
export function DeleteEngagementButton({ id, clientId }: { id: string; clientId: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      className="btn-ghost btn-sm text-red-700 hover:bg-red-50 hover:text-red-800"
      disabled={busy}
      onClick={() => {
        if (!confirm("Delete this assessment and its answers? This cannot be undone.")) return;
        start(async () => {
          try {
            await deleteEngagement(id, clientId);
            router.refresh();
          } catch (e) {
            alert((e as Error).message);
          }
        });
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
