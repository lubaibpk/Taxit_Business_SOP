import ExcelJS from "exceljs";
import type { TrackerSpec } from "@/lib/ai/pack-ai";

// Builds a working Excel tracker from an AI-designed spec: branded title block, totals row, styled header,
// dropdowns, date checks, per-row formulas, colour alerts, frozen header, filters and a "How to use" sheet.

const NAVY = "FF1F3864";
const GOLD = "FFF5C400";
const LIGHT = "FFD9E2F3";
const CALC = "FFF2F4F8";
const ALERT_FILL = { red: "FFF8CBAD", amber: "FFFFE699", green: "FFC6EFCE" } as const;
const ALERT_FONT = { red: "FF9C0006", amber: "FF7F6000", green: "FF006100" } as const;

const FIRST_ROW = 7; // first data row
const ROWS = 300;
const LAST_ROW = FIRST_ROW + ROWS - 1;

const colLetter = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

export async function buildTrackerWorkbook(input: {
  spec: TrackerSpec;
  clientName: string;
  departmentName: string;
  firmName: string;
  approved: boolean;
  logo?: { data: Uint8Array; type: "png" | "jpg" } | null;
}): Promise<Buffer> {
  const { spec } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = input.firmName;
  wb.created = new Date();
  const sheetName = `${spec.code}`.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "Tracker";
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: FIRST_ROW - 1, xSplit: 1 }], properties: { defaultRowHeight: 18 } });

  const cols = spec.columns;
  const letterOf = new Map<string, string>();
  cols.forEach((c, i) => {
    letterOf.set(c.key.toLowerCase(), colLetter(i + 1));
    letterOf.set(c.header.toLowerCase(), colLetter(i + 1));
  });
  const lastLetter = colLetter(cols.length);
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));

  // ── title block ──
  ws.mergeCells(`A1:${lastLetter}1`);
  ws.getCell("A1").value = input.clientName.toUpperCase();
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.mergeCells(`A2:${lastLetter}2`);
  ws.getCell("A2").value = `${spec.code} — ${spec.title}${input.approved ? "" : "   (DRAFT)"}`;
  ws.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF16213A" } };
  ws.mergeCells(`A3:${lastLetter}3`);
  ws.getCell("A3").value = spec.purpose;
  ws.getCell("A3").font = { italic: true, size: 10, color: { argb: "FF4E5A6E" } };
  ws.getCell("A3").alignment = { wrapText: true, vertical: "top" };
  ws.getRow(3).height = 30;
  ws.mergeCells(`A4:${lastLetter}4`);
  ws.getCell("A4").value = `Owner: ${spec.owner}   ·   Update: ${spec.frequency}   ·   ${input.departmentName}   ·   Prepared by ${input.firmName}`;
  ws.getCell("A4").font = { size: 9, color: { argb: "FF4E5A6E" } };
  if (input.logo) {
    const img = wb.addImage({ buffer: Buffer.from(input.logo.data) as unknown as ExcelJS.Buffer, extension: input.logo.type === "png" ? "png" : "jpeg" });
    ws.addImage(img, { tl: { col: Math.max(cols.length - 1, 1), row: 0 }, ext: { width: 56, height: 56 } });
  }

  // ── totals row (5) ──
  const totalsRow = ws.getRow(5);
  totalsRow.getCell(1).value = "Totals";
  totalsRow.getCell(1).font = { bold: true, color: { argb: NAVY } };
  const totalKeys = new Set(spec.totals.map((t) => t.toLowerCase()));
  cols.forEach((c, i) => {
    if (!totalKeys.has(c.key.toLowerCase()) || i === 0) return;
    const L = colLetter(i + 1);
    const cell = totalsRow.getCell(i + 1);
    cell.value = { formula: `SUBTOTAL(9,${L}${FIRST_ROW}:${L}${LAST_ROW})` };
    cell.font = { bold: true };
    cell.numFmt = numFmt(c.type);
  });

  // ── header row (6) ──
  const header = ws.getRow(FIRST_ROW - 1);
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { wrapText: true, vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: GOLD } } };
  });
  header.height = 34;
  ws.autoFilter = { from: { row: FIRST_ROW - 1, column: 1 }, to: { row: FIRST_ROW - 1, column: cols.length } };

  // ── data rows: formats, dropdowns, formulas ──
  const listsSheet = wb.addWorksheet("Lists", { state: "hidden" });
  let listCol = 0;
  cols.forEach((c, i) => {
    const L = colLetter(i + 1);
    const range = `${L}${FIRST_ROW}:${L}${LAST_ROW}`;
    let listRef: string | null = null;
    if (c.type === "list" && c.options.length) {
      const inline = `"${c.options.map((o) => o.replace(/[",]/g, " ")).join(",")}"`;
      if (inline.length <= 250) listRef = inline;
      else {
        listCol++;
        const LL = colLetter(listCol);
        c.options.forEach((o, j) => (listsSheet.getCell(`${LL}${j + 1}`).value = o));
        listRef = `Lists!$${LL}$1:$${LL}$${c.options.length}`;
      }
    }
    const formula = c.type === "formula" ? translateFormula(c.formula, letterOf) : null;

    for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
      const cell = ws.getCell(`${L}${r}`);
      cell.numFmt = numFmt(c.type);
      if (listRef) cell.dataValidation = { type: "list", allowBlank: true, formulae: [listRef], showErrorMessage: true, errorTitle: c.header, error: "Choose a value from the list." };
      else if (c.type === "date") cell.dataValidation = { type: "date", operator: "greaterThan", allowBlank: true, formulae: [new Date(2000, 0, 1)], showErrorMessage: true, error: "Enter a valid date." };
      else if (c.type === "number" || c.type === "currency" || c.type === "percent") cell.dataValidation = { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [-1e12], showErrorMessage: true, error: "Enter a number." };
      if (formula) {
        cell.value = { formula: formula.replace(/\{row\}/g, String(r)) };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CALC } };
        cell.font = { italic: true, color: { argb: "FF4E5A6E" } };
      }
      if (r % 2 === 0 && !formula) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFBFD" } };
    }
    void range;
  });

  // ── colour alerts ──
  for (const a of spec.alerts) {
    const L = letterOf.get(a.column.toLowerCase());
    if (!L) continue;
    const ref = `$${L}${FIRST_ROW}`;
    const n = Number(a.value);
    let expr: string | null = null;
    if (a.rule === "date_past") expr = `AND(${ref}<>"",${ref}<TODAY())`;
    else if (a.rule === "date_within_days" && Number.isFinite(n)) expr = `AND(${ref}<>"",${ref}>=TODAY(),${ref}-TODAY()<=${n})`;
    else if (a.rule === "greater_than" && Number.isFinite(n)) expr = `AND(${ref}<>"",${ref}>${n})`;
    else if (a.rule === "less_than" && Number.isFinite(n)) expr = `AND(${ref}<>"",${ref}<${n})`;
    else if (a.rule === "equals") expr = `${ref}="${String(a.value).replace(/"/g, "")}"`;
    if (!expr) continue;
    ws.addConditionalFormatting({
      ref: `${L}${FIRST_ROW}:${L}${LAST_ROW}`,
      rules: [
        {
          type: "expression",
          priority: 1,
          formulae: [expr],
          style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: ALERT_FILL[a.color] } }, font: { color: { argb: ALERT_FONT[a.color] }, bold: true } },
        },
      ],
    });
  }

  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${FIRST_ROW - 1}:${FIRST_ROW - 1}` };
  ws.headerFooter = { oddFooter: `&L${input.clientName} — ${spec.code}&RPage &P of &N` };

  // ── how-to sheet ──
  const guide = wb.addWorksheet("How to use");
  guide.columns = [{ width: 28 }, { width: 16 }, { width: 70 }];
  guide.getCell("A1").value = `${spec.code} — ${spec.title}`;
  guide.getCell("A1").font = { bold: true, size: 13, color: { argb: NAVY } };
  guide.getCell("A2").value = spec.purpose;
  guide.getCell("A2").alignment = { wrapText: true };
  guide.mergeCells("A2:C2");
  guide.getRow(2).height = 32;
  guide.getCell("A3").value = `Owner: ${spec.owner} · Update: ${spec.frequency}`;
  const h = guide.getRow(5);
  ["Column", "Type", "What to enter"].forEach((t, i) => {
    const c = h.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  });
  cols.forEach((c, i) => {
    const row = guide.getRow(6 + i);
    row.getCell(1).value = c.header;
    row.getCell(2).value = c.type === "formula" ? "Calculated" : c.type === "list" ? `List: ${c.options.join(", ")}` : c.type;
    row.getCell(3).value = c.description;
    row.getCell(2).alignment = { wrapText: true };
    row.getCell(3).alignment = { wrapText: true };
  });
  let r = 7 + cols.length;
  if (spec.alerts.length) {
    guide.getCell(`A${r}`).value = "Colour alerts";
    guide.getCell(`A${r}`).font = { bold: true, color: { argb: NAVY } };
    r++;
    for (const a of spec.alerts) {
      guide.getCell(`A${r}`).value = cols.find((c) => c.key.toLowerCase() === a.column.toLowerCase())?.header ?? a.column;
      guide.getCell(`B${r}`).value = a.color.toUpperCase();
      guide.getCell(`B${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALERT_FILL[a.color] } };
      guide.getCell(`C${r}`).value = a.meaning;
      guide.getCell(`C${r}`).alignment = { wrapText: true };
      r++;
    }
  }
  guide.getCell(`A${r + 1}`).value = "Grey cells are calculated automatically — do not type over them. Add rows by typing below the last record (formulas and checks are ready for 300 rows).";
  guide.getCell(`A${r + 1}`).font = { italic: true, color: { argb: "FF4E5A6E" } };
  void LIGHT;

  wb.views = [{ x: 0, y: 0, width: 12000, height: 8000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function numFmt(type: string) {
  switch (type) {
    case "currency":
      return '#,##0.00 "SAR"';
    case "percent":
      return "0.0%";
    case "date":
      return "dd-mmm-yyyy";
    case "number":
      return "#,##0.##";
    default:
      return "General";
  }
}

/** "=[loan_amount]-[recovered]" → "=C{row}-D{row}"; returns null if it references unknown columns. */
function translateFormula(formula: string, letterOf: Map<string, string>): string | null {
  if (!formula.trim()) return null;
  let ok = true;
  const f = formula.trim().replace(/^=/, "").replace(/\[([^\]]+)\]/g, (_, name: string) => {
    const L = letterOf.get(name.trim().toLowerCase()) ?? letterOf.get(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"));
    if (!L) ok = false;
    return L ? `${L}{row}` : "0";
  });
  return ok ? f : null;
}
