import Link from "next/link";
import { requireStaff } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { ClientTable } from "./client-table";

export default async function ClientsPage() {
  const { supabase } = await requireStaff();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, name_ar, industry, city, erp_system, engagements(id, assessment_date)")
    .order("created_at", { ascending: false });

  const rows = (clients ?? []).map((c) => {
    const dates = (c.engagements ?? []).map((e) => e.assessment_date).sort();
    return { id: c.id, name: c.name, name_ar: c.name_ar, industry: c.industry, city: c.city, erp: c.erp_system, assessments: c.engagements?.length ?? 0, last: dates.at(-1) ?? null };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`${rows.length} client${rows.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/clients/new" className="btn">
            + New client
          </Link>
        }
      />
      {rows.length ? (
        <ClientTable rows={rows} />
      ) : (
        <EmptyState title="No clients yet" body="Add a client to start assessing their departments." action={<Link href="/clients/new" className="btn">Create client</Link>} />
      )}
    </div>
  );
}
