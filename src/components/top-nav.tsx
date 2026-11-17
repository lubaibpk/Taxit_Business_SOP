"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopNav({ isAdmin, name, role }: { isAdmin: boolean; name: string; role: string }) {
  const path = usePathname();
  const links = [
    { href: "/", label: "Dashboard", active: path === "/" },
    { href: "/clients", label: "Clients", active: path.startsWith("/clients") || path.startsWith("/engagements") || path.startsWith("/reports") },
    ...(isAdmin
      ? [
          { href: "/admin/library", label: "Library", active: path.startsWith("/admin/library") },
          { href: "/admin/users", label: "Team", active: path.startsWith("/admin/users") },
        ]
      : []),
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-brand">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">BS</span>
            <span className="hidden sm:inline">Business System Builder</span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-1.5 ${l.active ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:text-gray-900"}`}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-gray-500 md:inline">
            {name} · <span className="capitalize">{role}</span>
          </span>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
