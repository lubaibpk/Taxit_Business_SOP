import Link from "next/link";
import { requireStaff } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold text-[#1F3864]">
              Business System Builder
            </Link>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/">Clients</Link>
              {profile.role === "admin" && <Link href="/admin/library">Library</Link>}
              {profile.role === "admin" && <Link href="/admin/users">Team</Link>}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">
              {profile.full_name || profile.email} · <span className="capitalize">{profile.role}</span>
            </span>
            <form action="/auth/signout" method="post">
              <button className="text-blue-800">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
