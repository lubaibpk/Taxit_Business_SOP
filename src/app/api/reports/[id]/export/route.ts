import { createClient } from "@/lib/supabase/server";
import { renderReport } from "@/lib/docx/render-report";
import { loadReportForExport } from "@/lib/export/load-report";

export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const loaded = await loadReportForExport(supabase, id);
  if (!loaded) return new Response("Report not found", { status: 404 });
  const buffer = await renderReport(loaded.input);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${loaded.fileBase}.docx"`,
    },
  });
}
