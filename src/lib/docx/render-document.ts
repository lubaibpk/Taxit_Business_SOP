import { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, LevelFormat, Packer, PageNumber, Paragraph, TextRun } from "docx";
import type { Block } from "@/lib/blocks";
import { docKit, type RenderInput } from "./render-report";

const NAVY = "1F3864";
const FONT = "Calibri";

export type DocumentInput = {
  language: "en" | "ar";
  approved: boolean;
  firmName: string;
  client: RenderInput["client"];
  logo?: RenderInput["logo"];
  departmentName: string;
  kindLabel: string; // e.g. "Standard Operating Procedure"
  code: string; // e.g. "SOP CR-01"
  title: string;
  version: number;
  blocks: Block[];
};

/** One standalone, branded document (an SOP, form, policy, checklist or JD) with a document-control table. */
export async function renderDocument(input: DocumentInput): Promise<Buffer> {
  const { rtl, t, align, run, table, renderBlock } = docKit(input.language);
  const clientName = rtl && input.client.name_ar ? input.client.name_ar : input.client.name;

  const top: Paragraph[] = [];
  if (input.logo)
    top.push(
      new Paragraph({
        alignment: rtl ? AlignmentType.LEFT : AlignmentType.RIGHT,
        children: [new ImageRun({ type: input.logo.type, data: input.logo.data, transformation: { width: 64, height: 64 } })],
      }),
    );
  top.push(
    new Paragraph({ bidirectional: rtl, alignment: align, spacing: { after: 40 }, children: [run(clientName.toUpperCase(), { bold: true, size: 20, color: "595959" })] }),
    new Paragraph({ bidirectional: rtl, alignment: align, spacing: { after: 40 }, children: [run(`${input.kindLabel.toUpperCase()} · ${input.code}`, { bold: true, size: 20, color: "C00000" })] }),
    new Paragraph({
      bidirectional: rtl,
      alignment: align,
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 4 } },
      children: [run(input.title, { bold: true, size: 36, color: NAVY })],
    }),
  );

  const control = table(
    [t("Document control", "ضبط الوثيقة"), ""],
    [
      [t("Document code", "رمز الوثيقة"), input.code],
      [t("Department", "القسم"), input.departmentName],
      [t("Version", "الإصدار"), `v${input.version}${input.approved ? "" : t(" (draft)", " (مسودة)")}`],
      [t("Prepared by", "إعداد"), input.firmName],
      [t("Approved by / date", "اعتماد / تاريخ"), ""],
      [t("Effective date", "تاريخ السريان"), ""],
    ],
  );

  const body = input.blocks.flatMap((b) => renderBlock(b));
  const headerText = `${clientName}   |   ${input.code} — ${input.title}${input.approved ? "" : "   |   " + t("DRAFT", "مسودة")}`;

  const doc = new Document({
    creator: input.firmName,
    title: `${input.code} ${input.title}`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    numbering: {
      config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: align, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        headers: { default: new Header({ children: [new Paragraph({ bidirectional: rtl, alignment: AlignmentType.CENTER, children: [run(headerText, { size: 14, color: "7F7F7F" })] })] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                bidirectional: rtl,
                alignment: AlignmentType.CENTER,
                children: [
                  run(`© ${new Date().getFullYear()} ${input.firmName}   |   ${t("Page", "صفحة")} `, { size: 14, color: "7F7F7F" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "7F7F7F", font: FONT }),
                ],
              }),
            ],
          }),
        },
        children: [...top, control, new Paragraph({ spacing: { after: 200 }, children: [] }), ...body],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
