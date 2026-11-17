import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { ensureDepartmentsLoaded } from "@/lib/departments/sync";
import { PageHeader } from "@/components/ui";
import { NewAssessmentForm } from "./form";

export default async function NewAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  await ensureDepartmentsLoaded(supabase);
  const [{ data: client }, { data: departments }, { count }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", id).single(),
    supabase.from("departments").select("id, code, name, description, report_skeleton").order("sort"),
    supabase.from("engagements").select("id", { count: "exact", head: true }).eq("client_id", id),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        crumbs={[
          { href: "/clients", label: "Clients" },
          { href: `/clients/${id}`, label: client.name },
        ]}
        title={count ? "New re-assessment" : "New assessment"}
        subtitle="Choose the departments to review. You can add more departments to this assessment later."
      />
      <NewAssessmentForm
        clientId={id}
        defaultTitle={count ? `Re-assessment (round ${count + 1})` : "Initial business assessment"}
        departments={(departments ?? []).map((d) => ({ id: d.id, code: d.code, name: d.name, description: d.description, ready: (d.report_skeleton as unknown[]).length > 0 }))}
      />
    </div>
  );
}
