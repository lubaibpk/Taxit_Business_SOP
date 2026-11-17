import Link from "next/link";
import { requireStaff } from "@/lib/supabase/server";
import { DEPARTMENT_LIBRARY } from "@/lib/departments";
import { PageHeader, Pill } from "@/components/ui";
import { SyncButton } from "./sync-button";
import { DeleteDepartmentButton } from "./delete-department-button";

export default async function LibraryPage() {
  const { supabase, profile } = await requireStaff();
  const { data: depts } = await supabase.from("departments").select("id, code, name, description, is_custom, report_skeleton, questions(id), engagement_departments(id)").order("sort");
  const inCode = new Set(DEPARTMENT_LIBRARY.map((d) => d.code));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department library"
        subtitle="Every department here can be added to an assessment. Create your own for any business area — AI designs the report outline, supporting documents and questionnaire."
        actions={
          <>
            {profile.role === "admin" && <SyncButton />}
            <Link href="/admin/library/new" className="btn">
              + Create department
            </Link>
          </>
        }
      />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Department</th>
              <th className="px-5 py-2.5 font-medium">Sections</th>
              <th className="px-5 py-2.5 font-medium">Questions</th>
              <th className="px-5 py-2.5 font-medium">Used in</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {depts?.map((d) => {
              const sections = (d.report_skeleton as unknown[]).length;
              const ready = sections > 0 && d.questions.length > 0;
              const used = d.engagement_departments.length;
              return (
                <tr key={d.id} className="border-t border-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {d.name}
                      {d.is_custom && <Pill tone="blue">Custom</Pill>}
                    </div>
                    <div className="line-clamp-1 text-xs text-gray-500">{d.description}</div>
                  </td>
                  <td className="px-5 py-3">{sections}</td>
                  <td className="px-5 py-3">{d.questions.length}</td>
                  <td className="px-5 py-3">{used ? `${used} assessment${used === 1 ? "" : "s"}` : "—"}</td>
                  <td className="px-5 py-3">
                    {ready ? <Pill tone="green">Ready</Pill> : inCode.has(d.code) ? <Pill tone="amber">Not loaded</Pill> : <Pill>Not defined</Pill>}
                  </td>
                  <td className="px-5 py-3 text-right">{d.is_custom && !used && <DeleteDepartmentButton id={d.id} name={d.name} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
