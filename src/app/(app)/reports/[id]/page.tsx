import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { PageHeader, Pill, REPORT_STATUS } from "@/components/ui";
import { ReportEditor } from "./report-editor";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireStaff();
  const [{ data: report }, { data: sections }] = await Promise.all([
    supabase.from("reports").select("*, departments(name, code), engagements(id, title, clients(id, name))").eq("id", id).single(),
    supabase.from("report_sections").select("*").eq("report_id", id).order("sort"),
  ]);
  if (!report) notFound();
  const { data: comments } = await supabase
    .from("section_comments")
    .select("*, profiles(full_name, email)")
    .in("section_id", (sections ?? []).map((s) => s.id))
    .order("created_at");

  const eng = report.engagements;
  const st = REPORT_STATUS[report.status];
  return (
    <div className="space-y-5">
      <PageHeader
        crumbs={[
          { href: "/clients", label: "Clients" },
          { href: `/clients/${eng.clients.id}`, label: eng.clients.name },
          { href: `/engagements/${eng.id}`, label: eng.title },
          { href: `/engagements/${eng.id}/${report.departments.code}?step=report`, label: report.departments.name },
        ]}
        title={`${report.departments.name} report`}
        subtitle={`${report.language === "ar" ? "Arabic" : "English"} · version ${report.version}`}
        actions={<Pill tone={st.tone}>{st.label}</Pill>}
      />
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
