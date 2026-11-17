import { ClientForm } from "@/components/client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New client</h1>
      <ClientForm />
    </div>
  );
}
