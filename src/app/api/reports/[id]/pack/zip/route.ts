import { createClient } from "@/lib/supabase/server";
import { buildPackZip, loadPack } from "@/lib/pack/load";

export const maxDuration = 300;

/** The whole document pack as one zip (?format=docx or pdf for the documents). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "docx";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const pack = await loadPack(supabase, id);
  if (!pack) return new Response("Report not found", { status: 404 });
  const zip = await buildPackZip(pack, format);
  const name = `${pack.export.fileBase}-document-pack${format === "pdf" ? "-pdf" : ""}.zip`;
  return new Response(new Uint8Array(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
