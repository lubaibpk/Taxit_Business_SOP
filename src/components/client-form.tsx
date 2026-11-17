import Link from "next/link";
import { saveClient } from "@/app/(app)/actions";
import { SubmitButton } from "@/components/submit-button";

type Client = {
  id?: string;
  name?: string;
  name_ar?: string | null;
  cr_number?: string | null;
  vat_number?: string | null;
  industry?: string | null;
  business_model?: string | null;
  city?: string | null;
  address?: string | null;
  headcount?: number | null;
  erp_system?: string | null;
  categories?: string[];
  branches?: { name: string; city?: string | null }[];
  key_people?: { name: string; position: string; responsibilities?: string }[];
  notes?: string | null;
};

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-5 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ClientForm({ client }: { client?: Client }) {
  const c = client ?? {};
  const field = (name: keyof Client, label: string, opts: { placeholder?: string; type?: string; dir?: "rtl" } = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" name={name} type={opts.type ?? "text"} dir={opts.dir} defaultValue={(c[name] as string | number | undefined) ?? ""} placeholder={opts.placeholder} />
    </div>
  );
  return (
    <form action={saveClient} className="space-y-4">
      {c.id && <input type="hidden" name="id" value={c.id} />}

      <Group title="Company" hint="Printed on the report cover.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Company name (English) *</label>
            <input className="input" name="name" required defaultValue={c.name ?? ""} />
          </div>
          {field("name_ar", "Company name (Arabic)", { dir: "rtl" })}
          {field("cr_number", "CR number")}
          {field("vat_number", "VAT number")}
          {field("city", "City", { placeholder: "e.g. Makkah" })}
          {field("address", "Address")}
        </div>
        <div>
          <label className="label">Logo (PNG or JPG, under 2 MB){c.id ? " — leave empty to keep the current logo" : ""}</label>
          <input type="file" name="logo" accept="image/png,image/jpeg" className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm" />
        </div>
      </Group>

      <Group title="Business" hint="Helps the AI scale limits, thresholds and roles to this company.">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("industry", "Industry", { placeholder: "e.g. Wholesale trading" })}
          {field("business_model", "Business model", { placeholder: "e.g. Counter sales, van sales, B2B" })}
          {field("headcount", "Headcount", { type: "number" })}
          {field("erp_system", "ERP / accounting system", { placeholder: "e.g. Zoho Books, Odoo, Tally" })}
        </div>
        <div>
          <label className="label">Products / services (comma separated)</label>
          <input className="input" name="categories" defaultValue={(c.categories ?? []).join(", ")} placeholder="Cosmetics, Stationery, Sundries" />
        </div>
        <div>
          <label className="label">Branches — one per line: Name, City</label>
          <textarea
            className="input min-h-24"
            name="branches"
            defaultValue={(c.branches ?? []).map((b) => [b.name, b.city].filter(Boolean).join(", ")).join("\n")}
            placeholder={"Main branch, Makkah\nSecond branch, Jeddah"}
          />
        </div>
      </Group>

      <Group title="People & context" hint="Named people are used in roles tables, SOP owners and approval matrices.">
        <div>
          <label className="label">Key people — one per line: Name — Position — Responsibilities</label>
          <textarea
            className="input min-h-28"
            name="key_people"
            defaultValue={(c.key_people ?? []).map((p) => [p.name, p.position, p.responsibilities].filter(Boolean).join(" — ")).join("\n")}
            placeholder={"Ahmed — Director, Sales & Credit — owns customer credit decisions\nSara — Accounts Head"}
          />
        </div>
        <div>
          <label className="label">Consultant notes (anything the AI should know)</label>
          <textarea className="input min-h-20" name="notes" defaultValue={c.notes ?? ""} />
        </div>
      </Group>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link href={c.id ? `/clients/${c.id}` : "/clients"} className="btn-secondary">
          Cancel
        </Link>
        <SubmitButton pendingText="Saving…">{c.id ? "Save changes" : "Create client"}</SubmitButton>
      </div>
    </form>
  );
}
