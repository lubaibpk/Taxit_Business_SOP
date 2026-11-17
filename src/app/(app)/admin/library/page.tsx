import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { DEPARTMENT_LIBRARY } from "@/lib/departments";
import { SyncButton } from "./sync-button";

export default async function LibraryPage() {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") redirect("/");
  const { data: depts } = await supabase.from("departments").select("id, code, name, report_skeleton, questions(id)").order("sort");
  const inCode = new Set(DEPARTMENT_LIBRARY.map((d) => d.code));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Department library</h1>
          <p className="text-sm text-gray-500">
            Each department needs a questionnaire and a report outline before it can be assessed. Loading the library writes the latest definitions from the app into the database; running it again updates them without touching answers or reports.
          </p>
        </div>
        <SyncButton />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Report sections</th>
              <th className="px-4 py-2">Questions</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {depts?.map((d) => {
              const sections = (d.report_skeleton as unknown[]).length;
              const ready = sections > 0 && d.questions.length > 0;
              return (
                <tr key={d.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="px-4 py-2">{sections}</td>
                  <td className="px-4 py-2">{d.questions.length}</td>
                  <td className="px-4 py-2">
                    {ready ? (
                      <span className="text-green-700">Ready</span>
                    ) : inCode.has(d.code) ? (
                      <span className="text-amber-700">Not loaded yet</span>
                    ) : (
                      <span className="text-gray-500">Not defined</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
