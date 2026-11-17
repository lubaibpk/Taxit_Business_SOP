import Link from "next/link";
import { requireStaff } from "@/lib/supabase/server";
import { ScoreBadge } from "@/components/score-badge";
import { EmptyState, PageHeader, Stat } from "@/components/ui";

type Eng = {
  id: string;
  title: string;
  round: number;
  assessment_date: string;
  created_at: string;
  engagement_departments: { department_id: string; score: number | null; findings: string | null }[];
  reports: { id: string; status: string; department_id: string }[];
};

/** The assessment a client's row opens: the latest one with work in it, else the latest one. */
function mainEngagement(engs: Eng[]): Eng | undefined {
  const byNewest = [...engs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return byNewest.find((e) => e.reports.length || e.engagement_departments.some((d) => d.score !== null || d.findings)) ?? byNewest[0];
}

export default async function Dashboard() {
  const { supabase, profile } = await requireStaff();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, industry, city, logo_path, created_at, engagements(id, title, round, assessment_date, created_at, engagement_departments(department_id, score, findings), reports(id, status, department_id))")
    .order("created_at", { ascending: false });

  const rows = (clients ?? []).map((c) => {
    const eng = mainEngagement((c.engagements ?? []) as Eng[]);
    const eds = eng?.engagement_departments ?? [];
    const total = eds.length;
    const reports = eng?.reports ?? [];
    const withReport = new Set(reports.map((r) => r.department_id));
    const approvedDepts = new Set(reports.filter((r) => r.status === "approved").map((r) => r.department_id));
    const inReview = reports.filter((r) => r.status === "in_review").length;
    const scored = eds.filter((d) => d.score !== null);
    const health = scored.length ? Math.round((scored.reduce((s, d) => s + Number(d.score), 0) / scored.length) * 10) / 10 : null;
    const stages = [
      { label: "Questionnaire", done: scored.length },
      { label: "Findings", done: eds.filter((d) => d.findings).length },
      { label: "Reports", done: eds.filter((d) => withReport.has(d.department_id)).length },
      { label: "Approved", done: eds.filter((d) => approvedDepts.has(d.department_id)).length },
    ];
    const current = stages.find((s) => s.done < total);
    const next = !eng
      ? "Start assessment"
      : !current
        ? "All approved — download"
        : current.label === "Questionnaire"
          ? "Answer questionnaires"
          : current.label === "Findings"
            ? "Add findings"
            : current.label === "Reports"
              ? "Create reports"
              : inReview
                ? "Approve reports"
                : "Review reports";
    return { c, eng, total, stages, health, next, href: eng ? `/engagements/${eng.id}` : `/clients/${c.id}/assessments/new` };
  });

  const active = rows.filter((r) => r.eng && r.stages.some((s) => s.done < r.total)).length;
  const allReports = rows.flatMap((r) => r.eng?.reports ?? []);
  const canApprove = profile.role === "admin" || profile.role === "reviewer";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        subtitle="Each client’s journey at a glance. Click a client to continue their assessment."
        actions={
          <Link href="/clients/new" className="btn">
            + New client
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clients" value={rows.length} />
        <Stat label="Clients in progress" value={active} />
        <Stat label="Reports in review" value={allReports.filter((r) => r.status === "in_review").length} hint={canApprove ? "Waiting for your approval" : undefined} />
        <Stat label="Approved reports" value={allReports.filter((r) => r.status === "approved").length} />
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Clients</h2>
        {rows.length === 0 ? (
          <EmptyState title="No clients yet" body="Create a client and start their assessment. Their journey will show here." action={<Link href="/clients/new" className="btn">Create your first client</Link>} />
        ) : (
          <div className="card divide-y divide-gray-100 p-0">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,2.4fr)_140px_170px] gap-6 px-5 py-2.5 text-xs text-gray-500 lg:grid">
              <span>Client</span>
              <span>Journey (departments done / total)</span>
              <span>Health</span>
              <span className="text-right">Next step</span>
            </div>
            {rows.map(({ c, eng, total, stages, health, next, href }) => (
              <div key={c.id} className="grid items-center gap-4 px-5 py-4 hover:bg-gray-50 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2.4fr)_140px_170px] lg:gap-6">
                <div className="min-w-0">
                  <Link href={href} className="block truncate font-medium text-brand hover:underline">
                    {c.name}
                  </Link>
                  <div className="truncate text-xs text-gray-500">
                    {eng ? `${eng.title} · round ${eng.round} · ${eng.assessment_date}` : "No assessment yet"}
                    {" · "}
                    <Link href={`/clients/${c.id}`} className="hover:text-brand hover:underline">
                      client profile
                    </Link>
                  </div>
                </div>

                {eng ? (
                  <Link href={href} className="grid grid-cols-4 gap-2" title="Open assessment">
                    {stages.map((s, i) => {
                      const done = total > 0 && s.done >= total;
                      const started = s.done > 0;
                      return (
                        <div key={s.label} className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                                done ? "bg-green-600 text-white" : started ? "border border-brand text-brand" : "border border-gray-300 text-gray-400"
                              }`}
                            >
                              {done ? "✓" : i + 1}
                            </span>
                            <span className={`truncate text-xs ${started ? "text-gray-800" : "text-gray-400"}`}>{s.label}</span>
                          </div>
                          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full ${done ? "bg-green-600" : "bg-brand"}`} style={{ width: `${total ? (s.done / total) * 100 : 0}%` }} />
                          </div>
                          <div className="mt-1 text-[11px] text-gray-500">
                            {s.done}/{total}
                          </div>
                        </div>
                      );
                    })}
                  </Link>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}

                <div>
                  <ScoreBadge score={health} />
                </div>
                <div className="lg:text-right">
                  <Link href={href} className="btn btn-sm">
                    {next} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
