import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { ScoreBadge } from "@/components/score-badge";
import { PageHeader, Pill, REPORT_STATUS, Steps } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ensureDepartmentsLoaded } from "@/lib/departments/sync";
import { deptSteps, loadEngagementProgress } from "@/lib/progress";
import { addDepartmentToEngagement } from "../../actions";

export default async function EngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  await ensureDepartmentsLoaded(supabase);
  const [{ data: eng }, progress, { data: allDepts }] = await Promise.all([
    supabase.from("engagements").select("*, clients(id, name)").eq("id", id).single(),
    loadEngagementProgress(supabase, id),
    supabase.from("departments").select("id, name, report_skeleton").order("sort"),
  ]);
  if (!eng) notFound();

  const scored = progress.filter((p) => p.score !== null);
  const health = scored.length ? Math.round((scored.reduce((s, p) => s + (p.score ?? 0), 0) / scored.length) * 10) / 10 : null;
  const approvedCount = progress.filter((p) => p.latestReport?.status === "approved").length;
  const inEngagement = new Set(progress.map((p) => p.departmentId));
  const addable = (allDepts ?? []).filter((d) => !inEngagement.has(d.id) && (d.report_skeleton as unknown[]).length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { href: "/clients", label: "Clients" },
          { href: `/clients/${eng.clients.id}`, label: eng.clients.name },
        ]}
        title={eng.title}
        subtitle={`Round ${eng.round} · assessed ${eng.assessment_date}`}
      />

      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-gray-500">Overall business health</div>
          <div className="mt-1">
            <ScoreBadge score={health} />
          </div>
          <div className="mt-1 text-xs text-gray-400">Average of {scored.length} scored department{scored.length === 1 ? "" : "s"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Departments</div>
          <div className="mt-1 text-xl font-semibold">{progress.length}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Reports approved</div>
          <div className="mt-1 text-xl font-semibold">
            {approvedCount} / {progress.length}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Departments</h2>
        {progress.map((p) => (
          <div key={p.departmentId} className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/engagements/${id}/${p.code}`} className="font-medium hover:text-brand">
                  {p.name}
                </Link>
                <div className="text-xs text-gray-500">{p.description}</div>
              </div>
              <div className="flex items-center gap-2">
                {p.latestReport && <Pill tone={REPORT_STATUS[p.latestReport.status].tone}>{REPORT_STATUS[p.latestReport.status].label}</Pill>}
                <ScoreBadge score={p.score} />
              </div>
            </div>
            <Steps steps={deptSteps(p, id)} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                {p.reports.length > 1 && <span>{p.reports.length} report versions</span>}
              </div>
              <Link href={p.next.href} className="btn btn-sm">
                {p.next.label} →
              </Link>
            </div>
          </div>
        ))}
      </section>

      {addable.length > 0 && (
        <form action={addDepartmentToEngagement} className="card flex flex-wrap items-end gap-3">
          <input type="hidden" name="engagement_id" value={id} />
          <div className="min-w-64 flex-1">
            <label className="label">Add another department to this assessment</label>
            <select name="department_id" className="input">
              {addable.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton className="btn-secondary" pendingText="Adding…">
            Add department
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
