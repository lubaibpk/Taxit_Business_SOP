import Link from "next/link";
import { requireStaff } from "@/lib/supabase/server";
import { EmptyState, PageHeader, Pill, Progress, REPORT_STATUS, Stat } from "@/components/ui";

export default async function Dashboard() {
  const { supabase, profile } = await requireStaff();
  const [{ count: clientCount }, { data: engagements }, { data: reports }] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("engagements").select("id, status"),
    supabase
      .from("reports")
      .select("id, status, language, version, created_at, departments(name), engagements(id, title, clients(name)), report_sections(status, content)")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const active = (engagements ?? []).filter((e) => e.status === "in_progress").length;
  const all = reports ?? [];
  const inReview = all.filter((r) => r.status === "in_review").length;
  const approved = all.filter((r) => r.status === "approved").length;
  const canApprove = profile.role === "admin" || profile.role === "reviewer";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        subtitle="Pick up where you left off, or start a new client assessment."
        actions={
          <Link href="/clients/new" className="btn">
            + New client
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Clients" value={clientCount ?? 0} />
        <Stat label="Active assessments" value={active} />
        <Stat label="Reports in review" value={inReview} hint={canApprove && inReview ? "Waiting for your approval" : undefined} />
        <Stat label="Approved reports" value={approved} />
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Recent reports</h2>
        {all.length === 0 ? (
          <EmptyState
            title="No reports yet"
            body="Create a client, start an assessment, answer the questionnaire and generate a report. It will show up here."
            action={
              <Link href="/clients/new" className="btn">
                Create your first client
              </Link>
            }
          />
        ) : (
          <div className="card divide-y divide-gray-100 p-0">
            {all.map((r) => {
              const secs = (r.report_sections ?? []) as { status: string; content: { blocks?: unknown[] } | null }[];
              const written = secs.filter((s) => s.content?.blocks?.length).length;
              const ok = secs.filter((s) => s.status === "approved").length;
              const eng = r.engagements as unknown as { id: string; title: string; clients: { name: string } };
              const st = REPORT_STATUS[r.status];
              const next = written < secs.length ? "Write sections" : r.status === "draft" ? "Review sections" : r.status === "in_review" ? (canApprove ? "Approve" : "Awaiting approval") : "Download";
              return (
                <Link key={r.id} href={`/reports/${r.id}`} className="flex flex-wrap items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{eng.clients.name}</div>
                    <div className="truncate text-xs text-gray-500">
                      {(r.departments as unknown as { name: string }).name} · {r.language === "ar" ? "Arabic" : "English"} v{r.version}
                    </div>
                  </div>
                  <div className="w-40">
                    <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                      <span>
                        {written}/{secs.length} written
                      </span>
                      <span>{ok} approved</span>
                    </div>
                    <Progress value={written + ok} max={secs.length * 2} />
                  </div>
                  <Pill tone={st.tone}>{st.label}</Pill>
                  <span className="w-36 text-right text-xs font-medium text-brand">{next} →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
