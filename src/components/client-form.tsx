import { saveClient } from "@/app/(app)/actions";

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

export function ClientForm({ client }: { client?: Client }) {
  const c = client ?? {};
  const field = (name: keyof Client, label: string, opts: { placeholder?: string; type?: string } = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" name={name} type={opts.type ?? "text"} defaultValue={(c[name] as string | number | undefined) ?? ""} placeholder={opts.placeholder} />
    </div>
  );
  return (
    <form action={saveClient} className="card space-y-5">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Company name (English) *</label>
          <input className="input" name="name" required defaultValue={c.name ?? ""} />
        </div>
        <div>
          <label className="label">Company name (Arabic)</label>
          <input className="input" name="name_ar" dir="rtl" defaultValue={c.name_ar ?? ""} />
        </div>
        {field("cr_number", "CR number")}
        {field("vat_number", "VAT number")}
        {field("industry", "Industry", { placeholder: "e.g. Wholesale trading" })}
        {field("business_model", "Business model", { placeholder: "e.g. Counter sales (retail & wholesale), van sales" })}
        {field("city", "City", { placeholder: "e.g. Makkah" })}
        {field("headcount", "Headcount", { type: "number" })}
        {field("erp_system", "ERP / accounting system", { placeholder: "e.g. Zoho Books, Odoo, Tally" })}
        {field("address", "Address")}
      </div>
      <div>
        <label className="label">Products / services (comma separated)</label>
        <input className="input" name="categories" defaultValue={(c.categories ?? []).join(", ")} placeholder="Cosmetics, Stationery, Sundries" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Branches — one per line: Name, City</label>
          <textarea
            className="input min-h-28"
            name="branches"
            defaultValue={(c.branches ?? []).map((b) => [b.name, b.city].filter(Boolean).join(", ")).join("\n")}
            placeholder={"Main branch, Makkah\nSecond branch, Jeddah"}
          />
        </div>
        <div>
          <label className="label">Key people — one per line: Name — Position — Responsibilities</label>
          <textarea
            className="input min-h-28"
            name="key_people"
            defaultValue={(c.key_people ?? []).map((p) => [p.name, p.position, p.responsibilities].filter(Boolean).join(" — ")).join("\n")}
            placeholder={"Ahmed — Director, Sales & Credit — owns customer credit decisions\nSara — Accounts Head"}
          />
        </div>
      </div>
      <div>
        <label className="label">Consultant notes (context the AI should know)</label>
        <textarea className="input min-h-20" name="notes" defaultValue={c.notes ?? ""} />
      </div>
      <div>
        <label className="label">Client logo (PNG or JPG, under 2 MB)</label>
        <input type="file" name="logo" accept="image/png,image/jpeg" className="text-sm" />
      </div>
      <button className="btn">{c.id ? "Save changes" : "Create client"}</button>
    </form>
  );
}
