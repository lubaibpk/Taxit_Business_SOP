import { requireStaff } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { DepartmentDesigner } from "./designer";

export default async function NewDepartmentPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireStaff();
  const { returnTo } = await searchParams;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        crumbs={[{ href: "/admin/library", label: "Department library" }]}
        title="Create a department"
        subtitle="Name the department and AI designs its report outline, SOPs, forms, registers, KPIs, policies, checklists and questionnaire. You review and edit everything before saving."
      />
      <DepartmentDesigner returnTo={returnTo && returnTo.startsWith("/") ? returnTo : "/admin/library"} />
    </div>
  );
}
