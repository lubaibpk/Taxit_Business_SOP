import type { Block } from "@/lib/blocks";

// Splits the SOP / forms / policies / checklists / registers chapters of a report into one document per
// item, using the coded level-2 headings each item starts with ("SOP CR-01: …", "FORM CR-02: …", …).

export type DocKind = "sop" | "form" | "policy" | "checklist" | "register";

export type PackDoc = {
  id: string; // stable within a report version, e.g. "sops-2"
  kind: DocKind;
  code: string; // e.g. "SOP CR-01"
  title: string; // name after the code
  blocks: Block[];
};

const SECTION_KIND: Record<string, DocKind> = {
  sops: "sop",
  forms: "form",
  policies: "policy",
  checklists: "checklist",
  registers: "register",
};
export const PACK_SECTION_KEYS = Object.keys(SECTION_KIND);

// optional numbering ("16.2 "), then a code word and a code ("SOP CR-01", "REG HR-03", "POLICY CP-01")
const ITEM_HEADING = /^(?:\d+(?:\.\d+)*\.?\s+)?((?:SOP|FORM|POLICY|CHECKLIST|REG(?:ISTER)?)\s*[A-Z]{1,4}P?[-–]\s?\d{1,3}[A-Z]?)\s*[:—–-]?\s*(.*)$/i;

export function splitSection(sectionKey: string, blocks: Block[]): PackDoc[] {
  const kind = SECTION_KIND[sectionKey];
  if (!kind) return [];
  const docs: PackDoc[] = [];
  let current: PackDoc | null = null;
  for (const b of blocks) {
    if (b.type === "heading" && (b.level ?? 2) <= 2) {
      const m = b.text.trim().match(ITEM_HEADING);
      if (m) {
        current = { id: `${sectionKey}-${docs.length + 1}`, kind, code: m[1].replace(/\s+/g, " ").replace("–", "-").toUpperCase(), title: m[2].trim() || m[1], blocks: [] };
        docs.push(current);
        continue;
      }
      // any other level-2 heading ends the current item (e.g. "16.7 Register Control and Review")
      current = null;
      continue;
    }
    current?.blocks.push(b);
  }
  return docs.filter((d) => d.blocks.length > 0);
}

export const KIND_LABEL: Record<DocKind | "tracker" | "jd", { one: string; many: string }> = {
  sop: { one: "SOP", many: "Standard operating procedures" },
  form: { one: "Form", many: "Forms & templates" },
  policy: { one: "Policy", many: "Policies" },
  checklist: { one: "Checklist", many: "Checklists" },
  register: { one: "Register", many: "Register specifications" },
  tracker: { one: "Excel tracker", many: "Excel trackers" },
  jd: { one: "Job description", many: "Job descriptions" },
};
