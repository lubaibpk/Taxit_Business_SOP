import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { ClientForm } from "@/components/client-form";
import { createEngagement } from "../../actions";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [{ data: client }, { data: engagements }, { data: departments }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("engagements").select("id, title, round, assessment_date, status").eq("client_id", id).order("round", { ascending: false }),
    supabase.from("departments").select("id, name, report_skeleton").order("sort"),
  ]);
  if (!client) notFound();

  let logoUrl: string | null = null;
  if (client.logo_path) {
    const { data } = await supabase.storage.from("logos").createSignedUrl(client.logo_path, 600);
    logoUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-14 w-14 rounded border border-gray-200 bg-white object-contain" />
        )}
        <div>
          <h1 className="text-xl font-semibold">{client.name}</h1>
          <p className="text-sm text-gray-500">{[client.industry, client.city, client.erp_system].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Assessments</h2>
        {engagements?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {engagements.map((e) => (
              <Link key={e.id} href={`/engagements/${e.id}`} className="card block hover:border-blue-300">
                <div className="font-medium">{e.title}</div>
                <div className="text-sm text-gray-500">
                  Round {e.round} · {e.assessment_date} · {e.status.replace("_", " ")}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No assessments yet.</p>
        )}

        <form action={createEngagement} className="card space-y-4">
          <h3 className="font-medium">Start a new assessment</h3>
          <input type="hidden" name="client_id" value={client.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Title</label>
              <input className="input" name="title" defaultValue={engagements?.length ? "Re-assessment" : "Initial business assessment"} />
            </div>
            <div>
              <label className="label">Assessment date</label>
              <input className="input" type="date" name="assessment_date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div>
            <span className="label">Departments to assess</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {departments?.map((d) => {
                const ready = (d.report_skeleton as unknown[]).length > 0;
                return (
                  <label key={d.id} className={`flex items-center gap-2 text-sm ${ready ? "" : "text-gray-400"}`}>
                    <input type="checkbox" name="departments" value={d.id} disabled={!ready} defaultChecked={ready} />
                    {d.name}
                    {!ready && <span className="text-xs">(coming soon)</span>}
                  </label>
                );
              })}
            </div>
          </div>
          <button className="btn">Start assessment</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Client details</h2>
        <ClientForm client={client} />
      </section>
    </div>
  );
}
