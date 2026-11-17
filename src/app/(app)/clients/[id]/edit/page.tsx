import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!client) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        crumbs={[
          { href: "/clients", label: "Clients" },
          { href: `/clients/${id}`, label: client.name },
        ]}
        title="Edit client details"
      />
      <ClientForm client={client} />
    </div>
  );
}
