import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Block } from "@/lib/blocks";

const NAVY = "1F3864";
const ACCENT = "C00000";
const LIGHT = "D9E2F3";
const FONT = "Calibri";

export type RenderInput = {
  language: "en" | "ar";
  approved: boolean;
  firmName: string;
  client: { name: string; name_ar?: string | null; city?: string | null; cr_number?: string | null; industry?: string | null; categories?: string[]; branches?: { name: string }[] };
  logo?: { data: Uint8Array; type: "png" | "jpg" } | null;
  departmentName: string;
  reportTitle: string;
  reportDate: string;
  score: number | null;
  sections: { title: string; blocks: Block[] }[];
};

/** Shared building blocks (runs, paragraphs, tables, report blocks) for any Word document. */
export function docKit(language: "en" | "ar") {
  const rtl = language === "ar";
  const t = (en: string, ar: string) => (rtl ? ar : en);
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const run = (text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
    new TextRun({ text, font: FONT, rightToLeft: rtl, ...opts });

  const para = (text: string, opts: { bold?: boolean; size?: number; color?: string; spacingAfter?: number } = {}) =>
    new Paragraph({
      bidirectional: rtl,
      alignment: align,
      spacing: { after: opts.spacingAfter ?? 120 },
      children: [run(text, opts)],
    });

  const cell = (text: string, header: boolean, width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [
        new Paragraph({
          bidirectional: rtl,
          alignment: align,
          children: [run(text, { bold: header, size: 18, color: header ? "FFFFFF" : undefined })],
        }),
      ],
    });

  const table = (headers: string[], rows: string[][]) => {
    const cols = Math.max(headers.length, ...rows.map((r) => r.length), 1);
    const w = Math.floor(100 / cols);
    const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? "");
    const trs: TableRow[] = [];
    if (headers.length) trs.push(new TableRow({ tableHeader: true, children: pad(headers).map((h) => cell(h, true, w)) }));
    rows.forEach((r) => trs.push(new TableRow({ cantSplit: true, children: pad(r).map((c) => cell(c, false, w)) })));
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: rtl, rows: trs });
  };

  const renderBlock = (b: Block): (Paragraph | Table)[] => {
    switch (b.type) {
      case "heading":
        return [
          new Paragraph({
            heading: b.level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2,
            bidirectional: rtl,
            alignment: align,
            spacing: { before: 240, after: 120 },
            children: [run(b.text, { bold: true, color: NAVY, size: b.level === 3 ? 22 : 26 })],
          }),
        ];
      case "paragraph":
        return [para(b.text)];
      case "bullets":
        return b.items.map(
          (i) => new Paragraph({ bidirectional: rtl, alignment: align, numbering: { reference: "bullets", level: 0 }, children: [run(i)] }),
        );
      case "numbered":
        return b.items.map(
          (i, n) => new Paragraph({ bidirectional: rtl, alignment: align, spacing: { after: 80 }, children: [run(`${n + 1}.  `, { bold: true }), run(i)] }),
        );
      case "table":
        return [table(b.headers, b.rows), new Paragraph({ spacing: { after: 120 }, children: [] })];
      case "callout": {
        const fill = b.tone === "info" ? LIGHT : "FBE4E4";
        const color = b.tone === "info" ? NAVY : ACCENT;
        return [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            visuallyRightToLeft: rtl,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, color: "auto", fill },
                    margins: { top: 120, bottom: 120, left: 160, right: 160 },
                    borders: {
                      left: { style: BorderStyle.SINGLE, size: 24, color },
                      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    children: [
                      para(b.title.toUpperCase(), { bold: true, color, spacingAfter: 80 }),
                      ...b.items.map((i) => new Paragraph({ bidirectional: rtl, alignment: align, spacing: { after: 60 }, children: [run("•  " + i, { size: 20 })] })),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 160 }, children: [] }),
        ];
      }
    }
  };

  return { rtl, t, align, run, para, table, renderBlock };
}

export async function renderReport(input: RenderInput): Promise<Buffer> {
  const { rtl, t, align, run, para, table, renderBlock } = docKit(input.language);

  // ── Cover page ──
  const clientName = rtl && input.client.name_ar ? input.client.name_ar : input.client.name;
  const cover: (Paragraph | Table)[] = [];
  if (input.logo) {
    cover.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 400 },
        children: [new ImageRun({ type: input.logo.type, data: input.logo.data, transformation: { width: 160, height: 160 } })],
      }),
    );
  } else {
    cover.push(new Paragraph({ spacing: { before: 1600 }, children: [] }));
  }
  cover.push(
    new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: rtl, children: [run(clientName.toUpperCase(), { bold: true, size: 40, color: NAVY })] }),
  );
  if (input.client.categories?.length)
    cover.push(new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: rtl, spacing: { after: 600 }, children: [run(input.client.categories.join("  |  "), { size: 20, color: "595959" })] }));
  cover.push(
    new Paragraph({ alignment: AlignmentType.CENTER, bidirectional: rtl, spacing: { after: 200 }, children: [run(input.reportTitle.toUpperCase(), { bold: true, size: 34, color: ACCENT })] }),
  );
  cover.push(new Paragraph({ spacing: { after: 400 }, children: [] }));
  const coverRows: [string, string][] = [
    [t("Client", "العميل"), clientName],
    [t("Department", "القسم"), input.departmentName],
  ];
  if (input.client.branches?.length) coverRows.push([t("Branches covered", "الفروع"), input.client.branches.map((b) => b.name).join("  |  ")]);
  if (input.client.industry) coverRows.push([t("Industry", "القطاع"), input.client.industry]);
  if (input.client.cr_number) coverRows.push([t("CR number", "السجل التجاري"), input.client.cr_number]);
  if (input.score !== null) coverRows.push([t("Maturity score", "درجة النضج"), `${input.score} / 5`]);
  coverRows.push([t("Prepared by", "إعداد"), input.firmName]);
  coverRows.push([t("Report date", "تاريخ التقرير"), input.reportDate]);
  coverRows.push([t("Classification", "التصنيف"), t("CONFIDENTIAL — Management distribution only", "سري — للإدارة فقط")]);
  cover.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: rtl,
      rows: coverRows.map(
        ([k, v]) =>
          new TableRow({
            children: [
              new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, color: "auto", fill: LIGHT }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [para(k, { bold: true, spacingAfter: 0 })] }),
              new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [para(v, { spacingAfter: 0 })] }),
            ],
          }),
      ),
    }),
  );
  if (!input.approved)
    cover.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [run(t("DRAFT — NOT YET APPROVED", "مسودة — غير معتمدة"), { bold: true, color: ACCENT, size: 28 })] }));
  cover.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Contents ──
  cover.push(para(t("TABLE OF CONTENTS", "جدول المحتويات"), { bold: true, size: 32, color: NAVY, spacingAfter: 240 }));
  cover.push(table([t("Section", "القسم"), t("Title", "العنوان")], input.sections.map((s, i) => [String(i + 1), s.title])));
  cover.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Body ──
  const body: (Paragraph | Table)[] = [];
  input.sections.forEach((s, i) => {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        bidirectional: rtl,
        alignment: align,
        pageBreakBefore: i > 0,
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } },
        children: [run(`${i + 1} — ${s.title.toUpperCase()}`, { bold: true, size: 30, color: NAVY })],
      }),
    );
    s.blocks.forEach((b) => body.push(...renderBlock(b)));
  });

  const headerText = `${clientName.toUpperCase()}   |   ${input.reportTitle.toUpperCase()}${input.approved ? "" : "   |   " + t("DRAFT", "مسودة")}`;

  const doc = new Document({
    creator: input.firmName,
    title: `${clientName} — ${input.reportTitle}`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: align, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1100, bottom: 1000, left: 1000, right: 1000 } }, titlePage: true },
        headers: {
          default: new Header({ children: [new Paragraph({ bidirectional: rtl, alignment: AlignmentType.CENTER, children: [run(headerText, { size: 14, color: "7F7F7F" })] })] }),
          first: new Header({ children: [] }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                bidirectional: rtl,
                alignment: AlignmentType.CENTER,
                children: [
                  run(`© ${new Date().getFullYear()} ${input.firmName}   |   ${t("Prepared for", "أُعد لصالح")} ${clientName}   |   ${t("Page", "صفحة")} `, { size: 14, color: "7F7F7F" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "7F7F7F", font: FONT }),
                ],
              }),
            ],
          }),
          first: new Footer({ children: [] }),
        },
        children: [...cover, ...body],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
