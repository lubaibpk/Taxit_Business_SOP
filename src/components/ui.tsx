import Link from "next/link";

/** Shared page furniture: breadcrumbs + title row, progress bars, status pills, step indicators. */

export function PageHeader({
  crumbs = [],
  title,
  subtitle,
  actions,
  leading,
}: {
  crumbs?: { href: string; label: string }[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {crumbs.length > 0 && (
        <nav className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300">/</span>}
              <Link href={c.href} className="hover:text-brand">
                {c.label}
              </Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <div className="mt-0.5 text-sm text-gray-500">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, max, tone = "brand" }: { value: number; max: number; tone?: "brand" | "green" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={`h-full rounded-full ${tone === "green" ? "bg-green-600" : "bg-brand"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const PILL: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-50 text-blue-800",
  amber: "bg-amber-50 text-amber-800",
  purple: "bg-purple-50 text-purple-800",
  green: "bg-green-50 text-green-800",
  red: "bg-red-50 text-red-800",
};

export function Pill({ tone = "gray", children }: { tone?: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PILL[tone]}`}>{children}</span>;
}

export const REPORT_STATUS: Record<string, { label: string; tone: keyof typeof PILL }> = {
  draft: { label: "Draft", tone: "amber" },
  in_review: { label: "In review", tone: "purple" },
  approved: { label: "Approved", tone: "green" },
};

/** Horizontal step indicator: done steps are filled, the current one is outlined. */
export function Steps({ steps }: { steps: { label: string; state: "done" | "current" | "todo" | "skip"; href?: string; detail?: string }[] }) {
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const dot =
          s.state === "done"
            ? "bg-green-600 text-white border-green-600"
            : s.state === "current"
              ? "border-brand text-brand bg-white"
              : "border-gray-300 text-gray-400 bg-white";
        const body = (
          <div className="flex items-start gap-2">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${dot}`}>
              {s.state === "done" ? "✓" : i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-xs font-medium ${s.state === "todo" || s.state === "skip" ? "text-gray-400" : "text-gray-800"}`}>{s.label}</span>
              {s.detail && <span className="block truncate text-[11px] text-gray-500">{s.detail}</span>}
            </span>
          </div>
        );
        return (
          <li key={s.label}>
            {s.href ? (
              <Link href={s.href} className="block rounded-lg p-1 hover:bg-gray-50">
                {body}
              </Link>
            ) : (
              <div className="p-1">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <div className="font-medium">{title}</div>
      {body && <p className="max-w-md text-sm text-gray-500">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}
