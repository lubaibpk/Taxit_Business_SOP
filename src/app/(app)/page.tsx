import Link from "next/link";
import { requireStaff } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const { supabase } = await requireStaff();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, industry, city, erp_system, engagements(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Link href="/clients/new" className="btn">
          New client
        </Link>
      </div>
      {!clients?.length ? (
        <div className="card text-sm text-gray-600">No clients yet. Create the first one to start an assessment.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Industry</th>
                <th className="px-4 py-2">City</th>
                <th className="px-4 py-2">ERP</th>
                <th className="px-4 py-2">Assessments</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/clients/${c.id}`} className="text-blue-900">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.industry}</td>
                  <td className="px-4 py-2">{c.city}</td>
                  <td className="px-4 py-2">{c.erp_system}</td>
                  <td className="px-4 py-2">{c.engagements?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
