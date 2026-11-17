import type { SupabaseClient } from "@supabase/supabase-js";
import type { Block } from "@/lib/blocks";
import type { RenderInput } from "@/lib/docx/render-report";

/** Loads a report with its client, branding and sections, ready for Word or PDF rendering. */
export async function loadReportForExport(supabase: SupabaseClient, id: string): Promise<{ input: RenderInput; fileBase: string } | null> {
  const { data: report } = await supabase.from("reports").select("*, departments(*), engagements(*, clients(*))").eq("id", id).single();
  if (!report) return null;
  const [{ data: sections }, { data: ed }] = await Promise.all([
    supabase.from("report_sections").select("*").eq("report_id", id).order("sort"),
    supabase.from("engagement_departments").select("score").eq("engagement_id", report.engagement_id).eq("department_id", report.department_id).single(),
  ]);

  const client = report.engagements.clients;
  let logo: RenderInput["logo"] = null;
  if (client.logo_path) {
    const { data } = await supabase.storage.from("logos").download(client.logo_path);
    if (data) logo = { data: new Uint8Array(await data.arrayBuffer()), type: client.logo_path.endsWith(".png") ? "png" : "jpg" };
  }

  const ar = report.language === "ar";
  const approved = report.status === "approved";
  const input: RenderInput = {
    language: report.language,
    approved,
    firmName: process.env.FIRM_NAME || "Taxit",
    client,
    logo,
    departmentName: ar && report.departments.name_ar ? report.departments.name_ar : report.departments.name,
    reportTitle: report.departments.report_title || report.departments.name,
    reportDate: new Date(report.engagements.assessment_date).toLocaleDateString(ar ? "ar-SA" : "en-GB", { year: "numeric", month: "long" }),
    score: ed?.score === null || ed?.score === undefined ? null : Number(ed.score),
    sections: (sections ?? []).map((s) => ({ title: s.title, blocks: (s.content?.blocks ?? []) as Block[] })),
  };
  const fileBase = `${client.name}-${report.departments.code}-${report.language}-v${report.version}${approved ? "" : "-DRAFT"}`.replace(/[^\w.-]+/g, "_");
  return { input, fileBase };
}
