import { requireStaff } from "@/lib/supabase/server";
import { TopNav } from "@/components/top-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  return (
    <div className="min-h-screen">
      <TopNav isAdmin={profile.role === "admin"} name={profile.full_name || profile.email} role={profile.role} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
