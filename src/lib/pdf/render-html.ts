import type { Block } from "@/lib/blocks";
import type { RenderInput } from "@/lib/docx/render-report";

// Print-ready HTML for the PDF export. Same content and styling as the Word file:
// cover page with client logo, contents table, one page-break per section, navy tables.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function block(b: Block): string {
  switch (b.type) {
    case "heading":
      return b.level === 3 ? `<h3>${esc(b.text)}</h3>` : `<h2>${esc(b.text)}</h2>`;
    case "paragraph":
      return `<p>${esc(b.text)}</p>`;
    case "bullets":
      return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "numbered":
      return `<ol>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`;
    case "callout":
      return `<div class="callout ${b.tone === "info" ? "info" : "critical"}"><div class="callout-title">${esc(b.title)}</div><ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`;
    case "table": {
      const cols = Math.max(b.headers.length, ...b.rows.map((r) => r.length), 1);
      const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? "");
      const head = b.headers.length ? `<thead><tr>${pad(b.headers).map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : "";
      return `<table>${head}<tbody>${b.rows.map((r) => `<tr>${pad(r).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
  }
}

export function renderReportHtml(input: RenderInput): string {
  const rtl = input.language === "ar";
  const t = (en: string, ar: string) => (rtl ? ar : en);
  const clientName = rtl && input.client.name_ar ? input.client.name_ar : input.client.name;
  const logo = input.logo ? `<img class="logo" src="data:image/${input.logo.type === "png" ? "png" : "jpeg"};base64,${Buffer.from(input.logo.data).toString("base64")}" />` : "";

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

  return `<!doctype html>
<html lang="${rtl ? "ar" : "en"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&display=block" rel="stylesheet" />
<style>
  @page { size: A4; margin: 22mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; }
  :root { color-scheme: light; }
  html, body { background: #fff; }
  body { font-family: ${rtl ? "'Noto Naskh Arabic', 'Noto Sans'" : "'Noto Sans', 'Noto Naskh Arabic'"}, sans-serif; color: #1a1d23; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  .cover { page-break-after: always; text-align: center; padding-top: 30mm; }
  .logo { max-width: 45mm; max-height: 45mm; object-fit: contain; margin-bottom: 14mm; }
  .cover h1 { color: #1F3864; font-size: 24pt; margin: 0 0 4mm; letter-spacing: 0.5px; }
  .cats { color: #595959; font-size: 10pt; margin-bottom: 18mm; }
  .cover .title { color: #C00000; font-size: 17pt; font-weight: 700; margin: 0 auto 16mm; max-width: 150mm; text-transform: uppercase; }
  .cover table { width: 100%; text-align: start; }
  .cover td:first-child { width: 32%; background: #D9E2F3; font-weight: 600; }
  .draft { color: #C00000; font-weight: 700; font-size: 14pt; margin-top: 12mm; }
  .toc { page-break-after: always; }
  .toc h1, section > h1 { color: #1F3864; font-size: 16pt; border-bottom: 2px solid #1F3864; padding-bottom: 2mm; margin: 0 0 5mm; text-transform: uppercase; }
  section { page-break-before: always; }
  h2 { color: #1F3864; font-size: 13pt; margin: 6mm 0 2mm; page-break-after: avoid; }
  h3 { color: #1F3864; font-size: 11pt; margin: 4mm 0 2mm; page-break-after: avoid; }
  p { margin: 0 0 3mm; }
  ul, ol { margin: 0 0 3mm; padding-inline-start: 6mm; }
  li { margin-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 9pt; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { background: #1F3864; color: #fff; font-weight: 600; text-align: start; padding: 1.6mm 2mm; border: 1px solid #1F3864; }
  td { padding: 1.6mm 2mm; border: 1px solid #c9ced6; vertical-align: top; }
  .callout { border-inline-start: 4px solid #C00000; background: #FBE4E4; padding: 3mm 4mm; margin: 0 0 4mm; page-break-inside: avoid; }
  .callout.info { border-color: #1F3864; background: #D9E2F3; }
  .callout-title { font-weight: 700; text-transform: uppercase; color: #C00000; margin-bottom: 1.5mm; }
  .callout.info .callout-title { color: #1F3864; }
  .callout ul { margin: 0; }
</style>
</head>
<body>
  <div class="cover">
    ${logo}
    <h1>${esc(clientName.toUpperCase())}</h1>
    ${input.client.categories?.length ? `<div class="cats">${esc(input.client.categories.join("  |  "))}</div>` : ""}
    <div class="title">${esc(input.reportTitle)}</div>
    <table>${coverRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
    ${input.approved ? "" : `<div class="draft">${t("DRAFT — NOT YET APPROVED", "مسودة — غير معتمدة")}</div>`}
  </div>
  <div class="toc">
    <h1>${t("Table of contents", "جدول المحتويات")}</h1>
    <table><thead><tr><th style="width:14mm">#</th><th>${t("Section", "القسم")}</th></tr></thead>
    <tbody>${input.sections.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.title)}</td></tr>`).join("")}</tbody></table>
  </div>
  ${input.sections
    .map((s, i) => `<section><h1>${i + 1} — ${esc(s.title)}</h1>${s.blocks.length ? s.blocks.map(block).join("") : `<p><em>${t("Not written yet.", "لم يُكتب بعد.")}</em></p>`}</section>`)
    .join("")}
</body>
</html>`;
}

/** Small running header/footer used by Chromium's PDF engine. */
export function headerFooter(input: RenderInput) {
  const rtl = input.language === "ar";
  const clientName = rtl && input.client.name_ar ? input.client.name_ar : input.client.name;
  const style = `font-family: 'Noto Sans', 'Noto Naskh Arabic', sans-serif; font-size: 7px; color: #7f7f7f; width: 100%; text-align: center; padding: 0 16mm;`;
  const header = `<div dir="${rtl ? "rtl" : "ltr"}" style="${style}">${esc(clientName.toUpperCase())} &nbsp;|&nbsp; ${esc(input.reportTitle.toUpperCase())}${input.approved ? "" : rtl ? " &nbsp;|&nbsp; مسودة" : " &nbsp;|&nbsp; DRAFT"}</div>`;
  const footer = `<div dir="${rtl ? "rtl" : "ltr"}" style="${style}">© ${new Date().getFullYear()} ${esc(input.firmName)} &nbsp;|&nbsp; ${rtl ? "صفحة" : "Page"} <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
  return { header, footer };
}
