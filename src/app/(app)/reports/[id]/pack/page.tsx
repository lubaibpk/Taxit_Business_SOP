import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { loadPack, KIND_LABEL } from "@/lib/pack/load";
import { PACK_SECTION_KEYS } from "@/lib/pack/split";
import { PageHeader, Pill, REPORT_STATUS } from "@/components/ui";
import { PackView } from "./pack-view";

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [pack, { data: meta }, { data: sections }] = await Promise.all([
    loadPack(supabase, id),
    supabase.from("reports").select("status, version, language, departments(name, code), engagements(id, title, clients(id, name))").eq("id", id).single(),
    supabase.from("report_sections").select("id, key, title, content").eq("report_id", id).in("key", PACK_SECTION_KEYS),
  ]);
  if (!pack || !meta) notFound();
  const m = meta as unknown as { status: string; version: number; language: string; departments: { name: string; code: string }; engagements: { id: string; title: string; clients: { id: string; name: string } } };

  // chapters that hold no separately coded items (e.g. written before the pack format existed)
  const thin = (sections ?? [])
    .filter((s) => !pack.docs.some((d) => d.id.startsWith(`${s.key}-`)))
    .map((s) => ({ id: s.id, title: s.title, written: !!(s.content as { blocks?: unknown[] } | null)?.blocks?.length }));

  const groups = (["sop", "form", "policy", "checklist", "jd", "register"] as const).map((k) => ({
    kind: k,
    label: KIND_LABEL[k].many,
    items: pack.docs.filter((d) => d.kind === k).map((d) => ({ id: d.id, code: d.code, title: d.title })),
  }));
  const st = REPORT_STATUS[m.status];

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { href: "/clients", label: "Clients" },
          { href: `/clients/${m.engagements.clients.id}`, label: m.engagements.clients.name },
          { href: `/engagements/${m.engagements.id}`, label: m.engagements.title },
          { href: `/reports/${id}`, label: `${m.departments.name} report` },
        ]}
        title="Document pack"
        subtitle={`${m.departments.name} · ${m.language === "ar" ? "Arabic" : "English"} v${m.version} — every SOP, form, policy and checklist as its own file, plus Excel trackers and job descriptions.`}
        actions={<Pill tone={st.tone}>{st.label}</Pill>}
      />
      <PackView
        reportId={id}
        approved={m.status === "approved"}
        groups={groups}
        trackers={pack.trackers.map((t) => ({ id: t.id, code: t.code, title: t.title, columns: t.spec.columns.length, alerts: t.spec.alerts.length }))}
        hasRegisters={pack.hasRegisters}
        thin={thin}
      />
    </div>
  );
}
