import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { ReportEditor } from "./report-editor";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  const { data: report } = await supabase.from("reports").select("*, departments(name, code), engagements(id, title, clients(name))").eq("id", id).single();
  if (!report) notFound();
  const [{ data: sections }, { data: comments }] = await Promise.all([
    supabase.from("report_sections").select("*").eq("report_id", id).order("sort"),
    supabase.from("section_comments").select("*, profiles(full_name, email)").in(
      "section_id",
      (await supabase.from("report_sections").select("id").eq("report_id", id)).data?.map((s) => s.id) ?? [],
    ).order("created_at"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/engagements/${report.engagements.id}`} className="text-sm text-blue-800">
          ← {report.engagements.clients.name} · {report.engagements.title}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {report.departments.name} report · {report.language === "ar" ? "Arabic" : "English"} · v{report.version}
        </h1>
      </div>
      <ReportEditor
        reportId={id}
        reportStatus={report.status}
        language={report.language}
        canApprove={profile.role === "admin" || profile.role === "reviewer"}
        initialSections={sections ?? []}
        comments={comments ?? []}
      />
    </div>
  );
}
