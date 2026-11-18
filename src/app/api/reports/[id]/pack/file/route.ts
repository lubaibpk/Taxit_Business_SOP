import { createClient } from "@/lib/supabase/server";
import { docFileName, loadPack, renderDocPdf, renderDocWord, renderTracker, trackerFileName } from "@/lib/pack/load";

export const maxDuration = 60;

const TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** One file from the document pack: ?item=<id>&format=docx|pdf (documents) or xlsx (trackers). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const itemId = url.searchParams.get("item") ?? "";
  const format = (url.searchParams.get("format") ?? "docx") as keyof typeof TYPES;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const pack = await loadPack(supabase, id);
  if (!pack) return new Response("Report not found", { status: 404 });

  let body: Buffer;
  let name: string;
  const tracker = pack.trackers.find((t) => t.id === itemId);
  if (tracker) {
    body = await renderTracker(pack, tracker);
    name = trackerFileName(tracker);
  } else {
    const doc = pack.docs.find((d) => d.id === itemId);
    if (!doc) return new Response("Document not found — the report may have changed. Refresh the page.", { status: 404 });
    if (format === "pdf") {
      body = await renderDocPdf(pack, doc);
      name = docFileName(doc, "pdf");
    } else {
      body = await renderDocWord(pack, doc);
      name = docFileName(doc, "docx");
    }
  }
  const ext = name.split(".").pop() as keyof typeof TYPES;
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": TYPES[ext], "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}` },
  });
}
