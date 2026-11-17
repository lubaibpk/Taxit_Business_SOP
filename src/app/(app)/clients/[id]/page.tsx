import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { ScoreBadge } from "@/components/score-badge";
import { EmptyState, PageHeader, Pill, Progress } from "@/components/ui";
import { DeleteEngagementButton } from "./delete-engagement-button";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [{ data: client }, { data: engagements }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("engagements")
      .select("id, title, round, assessment_date, status, engagement_departments(score, departments(name)), reports(id, status)")
      .eq("client_id", id)
      .order("round", { ascending: false }),
  ]);
  if (!client) notFound();

  let logoUrl: string | null = null;
  if (client.logo_path) {
    const { data } = await supabase.storage.from("logos").createSignedUrl(client.logo_path, 600);
    logoUrl = data?.signedUrl ?? null;
  }
  const branches = (client.branches ?? []) as { name: string; city?: string }[];
  const people = (client.key_people ?? []) as { name: string; position: string }[];

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[{ href: "/clients", label: "Clients" }]}
        leading={
          logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-14 w-14 rounded-xl border border-gray-200 bg-white object-contain p-1" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand text-lg font-semibold text-white">{client.name.slice(0, 2).toUpperCase()}</div>
          )
        }
        title={client.name}
        subtitle={[client.industry, client.city, client.erp_system].filter(Boolean).join(" · ") || "No details yet"}
        actions={
          <>
            <Link href={`/clients/${id}/edit`} className="btn-secondary">
              Edit details
            </Link>
            <Link href={`/clients/${id}/assessments/new`} className="btn">
              + New assessment
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4 text-sm">
          <div className="text-xs text-gray-500">Registration</div>
          <div className="mt-1">CR {client.cr_number || "—"}</div>
          <div>VAT {client.vat_number || "—"}</div>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-xs text-gray-500">Branches ({branches.length})</div>
          <div className="mt-1 line-clamp-2 text-gray-700">{branches.map((b) => b.name).join(", ") || "—"}</div>
        </div>
        <div className="card p-4 text-sm">
          <div className="text-xs text-gray-500">Key people ({people.length})</div>
          <div className="mt-1 line-clamp-2 text-gray-700">{people.map((p) => p.name).join(", ") || "—"}</div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">Assessments</h2>
        {!engagements?.length ? (
          <EmptyState
            title="No assessments yet"
            body="Start an assessment, pick the departments to review, then answer each questionnaire."
            action={
              <Link href={`/clients/${id}/assessments/new`} className="btn">
                Start first assessment
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {engagements.map((e) => {
              const eds = (e.engagement_departments ?? []) as unknown as { score: number | null; departments: { name: string } }[];
              const scored = eds.filter((d) => d.score !== null);
              const health = scored.length ? Math.round((scored.reduce((s, d) => s + Number(d.score), 0) / scored.length) * 10) / 10 : null;
              const reports = (e.reports ?? []) as { status: string }[];
              const approved = reports.filter((r) => r.status === "approved").length;
              return (
                <div key={e.id} className="card relative space-y-3 transition hover:border-blue-300">
                  <Link href={`/engagements/${e.id}`} className="absolute inset-0 rounded-xl" aria-label={`Open ${e.title}`} />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-gray-500">
                        Round {e.round} · {e.assessment_date}
                      </div>
                    </div>
                    <ScoreBadge score={health} />
                  </div>
                  <div className="text-xs text-gray-600">{eds.map((d) => d.departments.name).join(" · ")}</div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                      <span>
                        {scored.length}/{eds.length} departments scored
                      </span>
                      <span>
                        {approved}/{reports.length} reports approved
                      </span>
                    </div>
                    <Progress value={scored.length} max={eds.length} />
                  </div>
                  <div className="relative flex items-center justify-between">
                    <Pill tone={e.status === "completed" ? "green" : "blue"}>{e.status === "completed" ? "Completed" : "In progress"}</Pill>
                    {reports.length === 0 && <DeleteEngagementButton id={e.id} clientId={id} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
