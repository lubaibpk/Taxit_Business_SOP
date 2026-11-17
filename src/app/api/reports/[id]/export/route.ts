import { createClient } from "@/lib/supabase/server";
import { renderReport } from "@/lib/docx/render-report";
import type { Block } from "@/lib/blocks";

export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { data: report } = await supabase.from("reports").select("*, departments(*), engagements(*, clients(*))").eq("id", id).single();
  if (!report) return new Response("Report not found", { status: 404 });
  const { data: sections } = await supabase.from("report_sections").select("*").eq("report_id", id).order("sort");
  const { data: ed } = await supabase
    .from("engagement_departments")
    .select("score")
    .eq("engagement_id", report.engagement_id)
    .eq("department_id", report.department_id)
    .single();

  const client = report.engagements.clients;
  let logo: { data: Uint8Array; type: "png" | "jpg" } | null = null;
  if (client.logo_path) {
    const { data } = await supabase.storage.from("logos").download(client.logo_path);
    if (data) logo = { data: new Uint8Array(await data.arrayBuffer()), type: client.logo_path.endsWith(".png") ? "png" : "jpg" };
  }

  const approved = report.status === "approved";
  const buffer = await renderReport({
    language: report.language,
    approved,
    firmName: process.env.FIRM_NAME || "Taxit",
    client,
    logo,
    departmentName: report.language === "ar" && report.departments.name_ar ? report.departments.name_ar : report.departments.name,
    reportTitle: report.departments.report_title || report.departments.name,
    reportDate: new Date(report.engagements.assessment_date).toLocaleDateString(report.language === "ar" ? "ar-SA" : "en-GB", {
      year: "numeric",
      month: "long",
    }),
    score: ed?.score === null || ed?.score === undefined ? null : Number(ed.score),
    sections: (sections ?? []).map((s) => ({ title: s.title, blocks: (s.content?.blocks ?? []) as Block[] })),
  });

  const safe = `${client.name}-${report.departments.code}-${report.language}-v${report.version}${approved ? "" : "-DRAFT"}`.replace(/[^\w.-]+/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safe}.docx"`,
    },
  });
}
