import Anthropic from "@anthropic-ai/sdk";
import { blocksToText, cleanBlocks, sectionJsonSchema, type Block } from "@/lib/blocks";

// AI parts of the document pack: Excel tracker designs (built into real spreadsheets by xlsx.ts)
// and job descriptions. Both follow fixed formats, so the cheaper model is used, at high effort.

const MODEL = "claude-sonnet-5-5";

export type TrackerColumn = {
  key: string;
  header: string;
  type: "text" | "number" | "currency" | "percent" | "date" | "list" | "formula";
  width: number;
  options: string[];
  formula: string; // e.g. "=[loan_amount]-[recovered]" using column keys; "" when not a formula column
  description: string;
};
export type TrackerAlert = {
  column: string;
  rule: "date_past" | "date_within_days" | "greater_than" | "less_than" | "equals";
  value: string;
  color: "red" | "amber" | "green";
  meaning: string;
};
export type TrackerSpec = {
  code: string;
  title: string;
  purpose: string;
  owner: string;
  frequency: string;
  columns: TrackerColumn[];
  alerts: TrackerAlert[];
  totals: string[];
};

const trackerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["trackers"],
  properties: {
    trackers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "title", "purpose", "owner", "frequency", "columns", "alerts", "totals"],
        properties: {
          code: { type: "string" },
          title: { type: "string" },
          purpose: { type: "string" },
          owner: { type: "string" },
          frequency: { type: "string" },
          columns: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "header", "type", "width", "options", "formula", "description"],
              properties: {
                key: { type: "string" },
                header: { type: "string" },
                type: { type: "string", enum: ["text", "number", "currency", "percent", "date", "list", "formula"] },
                width: { type: "integer" },
                options: { type: "array", items: { type: "string" } },
                formula: { type: "string" },
                description: { type: "string" },
              },
            },
          },
          alerts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["column", "rule", "value", "color", "meaning"],
              properties: {
                column: { type: "string" },
                rule: { type: "string", enum: ["date_past", "date_within_days", "greater_than", "less_than", "equals"] },
                value: { type: "string" },
                color: { type: "string", enum: ["red", "amber", "green"] },
                meaning: { type: "string" },
              },
            },
          },
          totals: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const TRACKER_SYSTEM = `You design Excel trackers (registers) for Saudi SMEs, as part of a consulting firm's document pack.
Each tracker becomes a real spreadsheet: one row per record, with dropdowns, dates, formulas and colour alerts.

Rules:
- 8–16 columns per tracker, in the order a clerk fills them. Keys are short snake_case and unique.
- Types: text, number, currency (SAR), percent, date, list (dropdown — give 2–8 options), formula.
- A formula column computes from other columns of the same row. Write it as an Excel formula using
  [column_key] references, e.g. "=[loan_amount]-[amount_recovered]" or "=IF([due_date]=\\"\\",\\"\\",TODAY()-[due_date])".
  Only reference keys that exist. Use only standard Excel functions. Non-formula columns have formula "".
- Alerts colour a column's cell: date_past (date before today), date_within_days (value = number of days),
  greater_than / less_than (numeric value), equals (text value). Red = action now, amber = watch, green = OK.
  2–5 alerts per tracker, each with a plain meaning ("Iqama expired — renew immediately").
- totals: keys of number/currency columns worth totalling (may be empty).
- Widths are character widths, 10–40.
- Use the register codes and names given (e.g. "REG CR-02"). Tailor columns and options to the client.
Plain text only.`;

export async function designTrackers(input: { clientBrief: string; registersText: string; department: string }): Promise<TrackerSpec[]> {
  const out = await callJson<{ trackers: TrackerSpec[] }>(
    TRACKER_SYSTEM,
    `Department: ${input.department}\n\nClient:\n${input.clientBrief}\n\nThe approved report's registers chapter (design one tracker per register it describes):\n${input.registersText}`,
    trackerSchema,
  );
  return (out.trackers ?? []).map(normaliseTracker).filter((t) => t.columns.length >= 2);
}

function normaliseTracker(t: TrackerSpec): TrackerSpec {
  const seen = new Set<string>();
  const columns = (t.columns ?? [])
    .map((c) => {
      let key = String(c.key || c.header || "col").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "col";
      while (seen.has(key)) key += "_2";
      seen.add(key);
      return {
        ...c,
        key,
        header: String(c.header || key),
        width: Math.min(45, Math.max(8, Number(c.width) || 16)),
        options: c.type === "list" ? (c.options ?? []).map(String).filter(Boolean).slice(0, 20) : [],
        formula: c.type === "formula" ? String(c.formula || "") : "",
        description: String(c.description || ""),
      };
    })
    .slice(0, 30);
  return { ...t, code: String(t.code || "REG"), title: String(t.title || "Tracker"), columns, alerts: t.alerts ?? [], totals: t.totals ?? [] };
}

// ───────────────────────── Job descriptions ─────────────────────────

const jdSchema = {
  type: "object",
  additionalProperties: false,
  required: ["jds"],
  properties: {
    jds: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "person", "blocks"],
        properties: {
          role: { type: "string" },
          person: { type: "string", description: "Named person holding the role, or empty string" },
          blocks: sectionJsonSchema.properties.blocks,
        },
      },
    },
  },
} as const;

const JD_SYSTEM = `You write job descriptions for Saudi SMEs as part of a consulting firm's document pack, in the style of a
professional HR consultancy. One JD per key role in the department.

Each JD, as blocks, in this order:
1. A table "Job details": Field | Details — Position, Name (if a person is named, else "To be appointed"),
   Department, Reports to, Coordinates with, Location, Employment type.
2. Heading "Job purpose" + one paragraph.
3. Heading "Oversight role" + paragraph and bullets (what they plan, assign, review and approve).
4. Heading "Key responsibilities" + numbered sub-headings (level 3) each with bullets — 5–8 areas.
5. Heading "Authority limits" + table (Decision | Limit / authority).
6. Heading "Key performance indicators" + table (KPI | Target | Frequency).
7. Heading "Qualifications & experience" + bullets.
Use the responsibilities, controls, SOPs and limits from the approved report, and the client's real names.
Level-2 headings for main headings. Plain text only, no markdown.`;

export async function writeJobDescriptions(input: { clientBrief: string; reportText: string; department: string; language: "en" | "ar" }) {
  const out = await callJson<{ jds: { role: string; person: string; blocks: unknown[] }[] }>(
    JD_SYSTEM,
    `Department: ${input.department}\n${input.language === "ar" ? "Write in formal Modern Standard Arabic." : "Write in English."}\n\nClient:\n${input.clientBrief}\n\nApproved report (roles, controls and procedures to draw from):\n${input.reportText}\n\nWrite a JD for each key role in this department (3–6 roles).`,
    jdSchema,
  );
  return (out.jds ?? [])
    .map((j) => ({ role: String(j.role || "Role"), person: String(j.person || ""), blocks: cleanBlocks({ blocks: j.blocks }) }))
    .filter((j) => j.blocks.length);
}

// ───────────────────────── shared call ─────────────────────────

async function callJson<T>(system: string, user: string, schema: unknown): Promise<T> {
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
    system,
    messages: [{ role: "user", content: user }],
  });
  let message;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) throw new Error("The Claude API account is out of credit. Add credit at console.anthropic.com → Billing.");
    if (e instanceof Anthropic.APIError) throw new Error(`Claude API error (${e.status}). Please try again.`);
    throw e;
  }
  if (message.stop_reason === "refusal") throw new Error("The model declined this request. Please try again.");
  if (message.stop_reason === "max_tokens") throw new Error("The answer was too long and got cut off. Please try again.");
  const content = message.content as { type: string; text?: string }[];
  const last = content.map((b) => b.type).lastIndexOf("fallback");
  const text = content.slice(last + 1).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("The AI's answer could not be read. Please try again.");
  }
}

export const blocksAsText = (blocks: Block[]) => blocksToText(blocks);
