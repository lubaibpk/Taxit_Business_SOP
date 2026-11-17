// Report content model shared by the AI writer, the review editor and the Word renderer.

export type Block =
  | { type: "heading"; text: string; level?: number }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; title: string; items: string[]; tone?: "critical" | "info" };

export type SectionContent = { blocks: Block[] };

/** JSON schema the model must follow when writing a section. */
export const sectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["blocks"],
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["heading", "paragraph", "bullets", "numbered", "table", "callout"] },
          text: { type: "string", description: "heading or paragraph text" },
          level: { type: "integer", description: "heading level: 2 or 3" },
          title: { type: "string", description: "callout title" },
          tone: { type: "string", enum: ["critical", "info"] },
          items: { type: "array", items: { type: "string" }, description: "bullets, numbered or callout items" },
          headers: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
      },
    },
  },
} as const;

/** Finds the list of blocks in whatever shape the model returned it. */
function findBlockList(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return findBlockList(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["blocks", "content", "section", "sections", "items"]) {
      const found = o[k] !== undefined ? findBlockList(o[k]) : null;
      if (found?.length) return found;
    }
    for (const v of Object.values(o)) if (Array.isArray(v) && v.length && typeof v[0] === "object") return v;
  }
  return null;
}

/** Drops malformed blocks so one bad block never breaks rendering. */
export function cleanBlocks(raw: unknown): Block[] {
  const list = findBlockList(raw);
  if (!list) return [];
  const out: Block[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      if (item.trim()) out.push({ type: "paragraph", text: item.trim() });
      continue;
    }
    const b = item as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x ?? "")) : []);
    // infer the type when the model left it out or used a synonym
    let type = str(b?.type).toLowerCase();
    if (!["heading", "paragraph", "bullets", "numbered", "table", "callout"].includes(type)) {
      if (type.startsWith("bullet") || type === "list") type = "bullets";
      else if (type.includes("number") || type === "ordered") type = "numbered";
      else if (Array.isArray(b?.rows) || Array.isArray(b?.headers)) type = "table";
      else if (b?.title && Array.isArray(b?.items)) type = "callout";
      else if (Array.isArray(b?.items)) type = "bullets";
      else if (str(b?.text)) type = type.startsWith("h") ? "heading" : "paragraph";
    }
    switch (type) {
      case "heading":
        if (str(b.text)) out.push({ type: "heading", text: str(b.text), level: b.level === 3 ? 3 : 2 });
        break;
      case "paragraph":
        if (str(b.text)) out.push({ type: "paragraph", text: str(b.text) });
        break;
      case "bullets":
      case "numbered":
        if (arr(b.items).length) out.push({ type, items: arr(b.items) });
        break;
      case "callout":
        out.push({ type: "callout", title: str(b.title), items: arr(b.items), tone: b.tone === "info" ? "info" : "critical" });
        break;
      case "table": {
        const headers = arr(b.headers);
        const rows = Array.isArray(b.rows) ? (b.rows as unknown[]).map(arr) : [];
        if (headers.length || rows.length) out.push({ type: "table", headers, rows });
        break;
      }
    }
  }
  return out;
}

// ───────────── Plain-text editing format (what reviewers edit) ─────────────
// ## Heading / ### Subheading
// paragraph lines
// - bullet          1. numbered
// | a | b |  (first row = header, an optional |---| line is ignored)
// !! Callout title  followed by - items

const cell = (s: string) => s.replace(/\|/g, "/").replace(/\n/g, " ");

export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return `${b.level === 3 ? "###" : "##"} ${b.text}`;
        case "paragraph":
          return b.text;
        case "bullets":
          return b.items.map((i) => `- ${i}`).join("\n");
        case "numbered":
          return b.items.map((i, n) => `${n + 1}. ${i}`).join("\n");
        case "callout":
          return [`!! ${b.title}`, ...b.items.map((i) => `- ${i}`)].join("\n");
        case "table": {
          const lines = [`| ${b.headers.map(cell).join(" | ")} |`, `|${b.headers.map(() => "---").join("|")}|`];
          for (const r of b.rows) lines.push(`| ${r.map(cell).join(" | ")} |`);
          return lines.join("\n");
        }
      }
    })
    .join("\n\n");
}

export function textToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const chunks = text.replace(/\r/g, "").split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) continue;
    const first = lines[0].trim();
    if (first.startsWith("!! ")) {
      blocks.push({
        type: "callout",
        title: first.slice(3).trim(),
        items: lines.slice(1).map((l) => l.trim().replace(/^-\s*/, "")),
        tone: "critical",
      });
    } else if (first.startsWith("|")) {
      const rows = lines
        .filter((l) => !/^\|?\s*:?-{2,}/.test(l.trim()))
        .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
      blocks.push({ type: "table", headers: rows[0] ?? [], rows: rows.slice(1) });
    } else if (/^#{2,3}\s/.test(first) && lines.length === 1) {
      blocks.push({ type: "heading", text: first.replace(/^#{2,3}\s/, ""), level: first.startsWith("###") ? 3 : 2 });
    } else if (lines.every((l) => /^\s*-\s/.test(l))) {
      blocks.push({ type: "bullets", items: lines.map((l) => l.replace(/^\s*-\s/, "")) });
    } else if (lines.every((l) => /^\s*\d+[.)]\s/.test(l))) {
      blocks.push({ type: "numbered", items: lines.map((l) => l.replace(/^\s*\d+[.)]\s/, "")) });
    } else {
      // a heading directly followed by text in one chunk
      if (/^#{2,3}\s/.test(first)) {
        blocks.push({ type: "heading", text: first.replace(/^#{2,3}\s/, ""), level: first.startsWith("###") ? 3 : 2 });
        lines.shift();
      }
      if (lines.length) blocks.push({ type: "paragraph", text: lines.join(" ") });
    }
  }
  return blocks;
}
