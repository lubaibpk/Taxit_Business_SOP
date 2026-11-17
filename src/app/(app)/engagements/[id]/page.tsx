import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { ScoreBadge } from "@/components/score-badge";
import { addDepartmentToEngagement } from "../../actions";
import { ensureDepartmentsLoaded } from "@/lib/departments/sync";

export default async function EngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  await ensureDepartmentsLoaded(supabase);
  const [{ data: eng }, { data: eds }, { data: reports }, { data: allDepts }] = await Promise.all([
    supabase.from("engagements").select("*, clients(id, name)").eq("id", id).single(),
    supabase.from("engagement_departments").select("*, departments(id, code, name, description)").eq("engagement_id", id),
    supabase.from("reports").select("id, department_id, language, status, version, created_at").eq("engagement_id", id).order("created_at"),
    supabase.from("departments").select("id, name, report_skeleton").order("sort"),
  ]);
  if (!eng) notFound();

  const scored = (eds ?? []).filter((e) => e.score !== null);
  const health = scored.length ? Math.round((scored.reduce((s, e) => s + Number(e.score), 0) / scored.length) * 10) / 10 : null;
  const inEngagement = new Set((eds ?? []).map((e) => e.department_id));
  const addable = (allDepts ?? []).filter((d) => !inEngagement.has(d.id) && (d.report_skeleton as unknown[]).length > 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/clients/${eng.clients.id}`} className="text-sm text-blue-800">
          ← {eng.clients.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{eng.title}</h1>
          <span className="text-sm text-gray-500">
            Round {eng.round} · {eng.assessment_date}
          </span>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-gray-500">Overall business health score</div>
          <div className="text-xs text-gray-400">Average of the assessed departments ({scored.length} of {eds?.length ?? 0} scored)</div>
        </div>
        <ScoreBadge score={health} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(eds ?? []).map((ed) => {
          const deptReports = (reports ?? []).filter((r) => r.department_id === ed.department_id);
          return (
            <div key={ed.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{ed.departments.name}</div>
                  <div className="text-xs text-gray-500">{ed.departments.description}</div>
                </div>
                <ScoreBadge score={ed.score === null ? null : Number(ed.score)} />
              </div>
              {ed.dimension_scores && (
                <div className="space-y-1">
                  {Object.entries(ed.dimension_scores as Record<string, number>).map(([d, s]) => (
                    <div key={d} className="flex items-center gap-2 text-xs">
                      <span className="w-44 shrink-0 text-gray-600">{d}</span>
                      <div className="h-1.5 flex-1 rounded bg-gray-100">
                        <div className="h-1.5 rounded bg-[#1F3864]" style={{ width: `${(s / 5) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right">{s}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href={`/engagements/${id}/${ed.departments.code}`} className="btn-secondary">
                  Questionnaire & data
                </Link>
                {deptReports.map((r) => (
                  <Link key={r.id} href={`/reports/${r.id}`} className="btn-secondary">
                    Report {r.language.toUpperCase()} v{r.version} · {r.status.replace("_", " ")}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {addable.length > 0 && (
        <form action={addDepartmentToEngagement} className="card flex flex-wrap items-end gap-3">
          <input type="hidden" name="engagement_id" value={id} />
          <div>
            <label className="label">Add a department</label>
            <select name="department_id" className="input">
              {addable.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-secondary">Add</button>
        </form>
      )}
    </div>
  );
}
