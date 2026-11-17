import Anthropic from "@anthropic-ai/sdk";
import type { DepartmentDef, QuestionDef } from "@/lib/departments/build";

// Designs a new department for the library from its name: the report outline (department-specific
// sections plus the standard SOP/forms/registers/KPI/policy/checklist/roadmap tail) and the
// maturity questionnaire. A one-off, high-value call, so it uses the strongest model.

export type DepartmentDraft = Omit<DepartmentDef, "code" | "sort">;

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "name", "name_ar", "description", "report_title", "prefix", "gapsTitle", "governance", "frameworks",
    "sops", "forms", "registers", "kpis", "policies", "checklists", "roadmapFocus", "outcomes", "questions",
  ],
  properties: {
    name: { type: "string", description: "Department name in English, title case" },
    name_ar: { type: "string", description: "Department name in Arabic" },
    description: { type: "string", description: "One sentence listing what the department covers" },
    report_title: { type: "string", description: "Report title, e.g. '... Governance Operating System'" },
    prefix: { type: "string", description: "2–3 uppercase letters for SOP/policy codes" },
    gapsTitle: { type: "string", description: "Uppercase callout title, e.g. 'CRITICAL ... GAPS — CURRENT STATE'" },
    governance: { type: "string", description: "Which roles the roles & accountability table must cover" },
    frameworks: {
      type: "array",
      description: "6–9 department-specific report sections, in logical order",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "title", "guidance"],
        properties: {
          key: { type: "string", description: "snake_case id" },
          title: { type: "string", description: "Section title in the style 'Topic — Subtitle'" },
          guidance: { type: "string", description: "1–3 sentences telling the writer exactly what tables and content the section needs" },
        },
      },
    },
    sops: { type: "string", description: "Comma-separated list of 6–8 SOP names for this department" },
    forms: { type: "string", description: "Comma-separated list of 4–6 forms" },
    registers: { type: "string", description: "Comma-separated list of 4–6 registers/trackers" },
    kpis: { type: "string", description: "Comma-separated list of 6–8 KPIs" },
    policies: { type: "string", description: "Comma-separated list of 6–8 policies" },
    checklists: { type: "string", description: "Comma-separated list of 5 checklists" },
    roadmapFocus: { type: "string", description: "What phase 1 and phase 2 of the roadmap should prioritise" },
    outcomes: { type: "string", description: "Measurable outcomes the conclusion should target" },
    questions: {
      type: "array",
      description: "First one profile question (answer_type text), then 10–16 maturity questions grouped into 4–7 dimensions",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dimension", "text", "weight", "answer_type"],
        properties: {
          dimension: { type: "string" },
          text: { type: "string", description: "A statement describing good practice, rated 0–4 for how well it works today" },
          weight: { type: "number", description: "1 normal, 1.5 important, 2 critical control" },
          answer_type: { type: "string", enum: ["maturity", "text"] },
        },
      },
    },
  },
} as const;

const SYSTEM = `You design assessment modules for a Saudi management consulting firm that writes department-level
governance and SOP reports ("operating systems") for privately owned businesses of any industry.

Given a department name (and optional scope and industry), design:
1. The department-specific report sections that sit between the executive summary/governance sections and
   the standard tail (SOPs, forms, registers, KPI dashboard, policies, checklists, roadmap, conclusion — these
   are added automatically, do not include them). Each section's guidance must say concretely which tables,
   matrices, workflows or thresholds to produce.
2. The lists that drive the standard tail (which SOPs, forms, registers, KPIs, policies, checklists).
3. A maturity questionnaire: each item is a statement of good practice that a consultant rates 0 (not in place)
   to 4 (monitored & improved). Cover the controls whose absence causes real loss, fraud, non-compliance or poor
   decisions. Weight critical controls higher.

Use Saudi context where relevant (ZATCA, GOSI, Qiwa, Mudad, municipality/Balady, Civil Defense, SFDA, MOH,
Saudi Labor Law, Nitaqat) only when it genuinely applies to this department. Keep it practical for SMEs.
Plain text only — no markdown.`;

export async function designDepartment(input: { name: string; scope?: string; industry?: string }): Promise<DepartmentDraft> {
  const client = new Anthropic();
  const ask = [
    `Department name: ${input.name}`,
    input.scope ? `What it should cover: ${input.scope}` : "",
    input.industry ? `Typical client industry: ${input.industry}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: schema as unknown as Record<string, unknown> } },
    system: SYSTEM,
    messages: [{ role: "user", content: ask }],
  });

  let message;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) throw new Error("The Claude API account is out of credit. Add credit at console.anthropic.com → Billing.");
    if (e instanceof Anthropic.APIError) throw new Error(`Claude API error (${e.status}). Please try again.`);
    throw e;
  }
  if (message.stop_reason === "refusal") throw new Error("The model declined this request. Try a different name or description.");
  if (message.stop_reason === "max_tokens") throw new Error("The design was too long. Try a narrower scope.");

  const text = message.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
  return normaliseDraft(JSON.parse(text));
}

const STANDARD_KEYS = new Set(["exec_summary", "governance", "sops", "forms", "registers", "dashboard", "policies", "checklists", "roadmap", "conclusion"]);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Cleans a draft (from the model or from the editor) so it is always safe to save. */
export function normaliseDraft(raw: Record<string, unknown>): DepartmentDraft {
  const prefix = (str(raw.prefix).toUpperCase().replace(/[^A-Z]/g, "") || "XX").slice(0, 3);
  const usedKeys = new Set<string>();
  const frameworks = (Array.isArray(raw.frameworks) ? raw.frameworks : [])
    .map((f: Record<string, unknown>) => {
      let key = str(f.key).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "section";
      if (STANDARD_KEYS.has(key)) key = `${key}_detail`;
      while (usedKeys.has(key)) key += "_2";
      usedKeys.add(key);
      return { key, title: str(f.title), guidance: str(f.guidance) };
    })
    .filter((f) => f.title);

  let n = 0;
  const questions: QuestionDef[] = (Array.isArray(raw.questions) ? raw.questions : [])
    .map((q: Record<string, unknown>) => {
      const isText = q.answer_type === "text";
      const code = isText ? `${prefix}-P${++n}` : `${prefix}-${String(++n).padStart(2, "0")}`;
      const weight = typeof q.weight === "number" && q.weight > 0 ? Math.min(q.weight, 3) : 1;
      return { code, dimension: str(q.dimension) || (isText ? "Profile" : "General"), text: str(q.text), weight, answer_type: isText ? ("text" as const) : ("maturity" as const) };
    })
    .filter((q) => q.text);

  return {
    prefix,
    name: str(raw.name),
    name_ar: str(raw.name_ar),
    description: str(raw.description),
    report_title: str(raw.report_title) || `${str(raw.name)} Governance Operating System`,
    gapsTitle: str(raw.gapsTitle) || `CRITICAL ${str(raw.name).toUpperCase()} GAPS — CURRENT STATE`,
    governance: str(raw.governance),
    frameworks,
    sops: str(raw.sops),
    forms: str(raw.forms),
    registers: str(raw.registers),
    kpis: str(raw.kpis),
    policies: str(raw.policies),
    checklists: str(raw.checklists),
    roadmapFocus: str(raw.roadmapFocus),
    outcomes: str(raw.outcomes),
    questions,
  };
}
