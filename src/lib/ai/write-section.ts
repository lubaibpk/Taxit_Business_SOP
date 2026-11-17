import Anthropic from "@anthropic-ai/sdk";
import { cleanBlocks, sectionJsonSchema, type Block } from "@/lib/blocks";

export const REPORT_MODEL = "claude-opus-5-5";

const STYLE_GUIDE = `You are a senior management consultant at a Saudi advisory firm. You write department-level
governance and SOP reports ("operating systems") for privately owned Saudi businesses — often family-run,
multi-branch, growing from informal to professionally governed.

House style (follow strictly):
- Formal, direct consulting English (or Modern Standard Arabic when asked). Short declarative sentences.
  Name the problem plainly, then the control that fixes it.
- Heavy use of tables: roles and accountability, authority matrices, workflows, KPI thresholds,
  registers and forms. Prefer a table whenever information has 3+ attributes per item.
- Workflows are tables: Step | Process action | Responsible | Output / document | Timeline.
- KPI tables always carry Green / Amber / Red thresholds.
- SOPs, policies, checklists and forms carry codes (e.g. SOP CR-01, POLICY CP-01, CHECKLIST CR-01, FORM CR-01)
  and are complete and ready to use — never "etc." or placeholders like "[insert]".
- Use the client's real names: company, branches, product categories, ERP system, and the people and
  positions provided. When a role is needed but no person is named, use a role title (e.g. "Credit Controller").
- Saudi context by default: SAR amounts, ZATCA (VAT, e-invoicing/Fatoora), Zakat, GOSI, Qiwa, Mudad,
  Wathq/Maroof for CR verification, Najiz for enforcing promissory notes (sanad lil-amr), Saudi Labor Law,
  IFRS as adopted by SOCPA. Do not invent specific legal article numbers, fees or deadlines you are not sure of.
- Scale thresholds and amounts to the client's size (headcount, branches, receivables) — never copy
  generic amounts that would be absurd for this business.
- Findings must come from the assessment data provided. Do not claim a gap the answers contradict, and do
  not invent statistics. Where client data exists, quote the actual figures.
- No marketing tone, no emojis, no markdown syntax inside text fields (no **, no #). Plain text only.

Output format: JSON matching the provided schema — an ordered list of blocks.
- heading (level 2 for sub-sections like "4.1 Authority Matrix", level 3 for minor headings)
- paragraph, bullets, numbered
- table (headers + rows; every row has the same number of cells as headers)
- callout (a boxed list, tone "critical" for gaps/risks or "info" for key principles)
Do NOT repeat the section title itself as the first heading — it is added automatically.`;

export type SectionJob = {
  language: "en" | "ar";
  clientContext: string; // identical for every section of one report (cached)
  sectionTitle: string;
  sectionNumber: number;
  guidance: string;
  instructions?: string | null;
  previousText?: string | null; // current draft, when regenerating with instructions
};

export async function writeSection(job: SectionJob): Promise<Block[]> {
  const client = new Anthropic();

  const ask = [
    `Write section ${job.sectionNumber}: "${job.sectionTitle}".`,
    `What this section must contain: ${job.guidance}`,
    job.language === "ar"
      ? "Write the whole section in formal Modern Standard Arabic suitable for a Saudi board. Keep codes (SOP CR-01 etc.), system names and abbreviations (ZATCA, GOSI, DSO) in Latin script."
      : "Write in English.",
    job.previousText ? `Current draft of this section (revise it rather than starting over):\n${job.previousText}` : "",
    job.instructions ? `Reviewer instructions — these take priority:\n${job.instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = client.beta.messages.stream({
    model: REPORT_MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: sectionJsonSchema as unknown as Record<string, unknown> },
    },
    system: [
      { type: "text", text: STYLE_GUIDE },
      { type: "text", text: job.clientContext, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: ask }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") throw new Error("The model declined to write this section. Edit the instructions and try again.");
  if (message.stop_reason === "max_tokens") throw new Error("The section was too long and got cut off. Ask for a shorter version in the instructions.");

  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The model returned content that could not be read. Please regenerate.");
  }
  const blocks = cleanBlocks(parsed);
  if (!blocks.length) throw new Error("The model returned an empty section. Please regenerate.");
  return blocks;
}
