import ExcelJS from "exceljs";

/** Reads the first worksheet of an .xlsx or a .csv file into a grid of plain values. */
export async function readSheet(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(buf.toString("utf8"));
  if (!name.endsWith(".xlsx")) throw new Error("Please upload an .xlsx or .csv file (export .xls files as .xlsx first).");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0) ?? wb.worksheets[0];
  if (!ws) return [];
  const grid: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values: unknown[] = [];
    for (let c = 1; c <= ws.columnCount; c++) values.push(cellValue(row.getCell(c).value));
    grid.push(values);
  });
  return grid;
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return v.result ?? null; // formula
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text; // hyperlink
    return null;
  }
  return v;
}

export function parseCsv(text: string): unknown[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}
