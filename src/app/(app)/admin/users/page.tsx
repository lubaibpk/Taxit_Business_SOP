import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { setUserRole } from "../../actions";

export default async function UsersPage() {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") redirect("/");
  const { data: users } = await supabase.from("profiles").select("*").order("created_at");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-gray-500">
          New sign-ups wait as &quot;pending&quot; until you give them a role. Consultants prepare assessments and reports; reviewers can also approve; admins manage the team.
        </p>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{u.full_name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  {u.id === profile.id ? (
                    <span className="capitalize">{u.role} (you)</span>
                  ) : (
                    <form action={setUserRole} className="flex gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <select name="role" defaultValue={u.role} className="input max-w-40 py-1">
                        <option value="pending">Pending</option>
                        <option value="consultant">Consultant</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button className="btn-secondary py-1">Save</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
