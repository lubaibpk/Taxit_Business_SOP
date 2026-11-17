import { ClientForm } from "@/components/client-form";
import { PageHeader } from "@/components/ui";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        crumbs={[{ href: "/clients", label: "Clients" }]}
        title="New client"
        subtitle="Only the company name is required. The more you add, the more specific the AI-written reports will be."
      />
      <ClientForm />
    </div>
  );
}
