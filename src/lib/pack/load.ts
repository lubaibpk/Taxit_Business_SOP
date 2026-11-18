import type { SupabaseClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import type { Block } from "@/lib/blocks";
import type { TrackerSpec } from "@/lib/ai/pack-ai";
import { loadReportForExport } from "@/lib/export/load-report";
import { renderReport } from "@/lib/docx/render-report";
import { renderDocument } from "@/lib/docx/render-document";
import { documentHeaderFooter, renderDocumentHtml } from "@/lib/pdf/render-html";
import { htmlToPdf, launchBrowser } from "@/lib/pdf/browser";
import { buildTrackerWorkbook } from "./xlsx";
import { KIND_LABEL, PACK_SECTION_KEYS, splitSection, type PackDoc } from "./split";

export type PackItemDoc = PackDoc | { id: string; kind: "jd"; code: string; title: string; blocks: Block[] };
export type PackTracker = { id: string; code: string; title: string; spec: TrackerSpec };

const DOC_KIND_LABEL: Record<string, string> = {
  sop: "Standard Operating Procedure",
  form: "Form",
  policy: "Policy",
  checklist: "Checklist",
  register: "Register specification",
  jd: "Job Description",
};
const FOLDER: Record<string, string> = { sop: "SOPs", form: "Forms", policy: "Policies", checklist: "Checklists", register: "Register specifications", jd: "Job descriptions" };

/** Everything in a report's document pack: split documents, AI job descriptions and tracker designs. */
export async function loadPack(supabase: SupabaseClient, reportId: string) {
  const loaded = await loadReportForExport(supabase, reportId);
  if (!loaded) return null;
  const [{ data: report }, { data: sections }, { data: items }] = await Promise.all([
    supabase.from("reports").select("id, version, status, language, engagement_id, department_id, departments(name, code)").eq("id", reportId).single(),
    supabase.from("report_sections").select("key, content").eq("report_id", reportId).in("key", PACK_SECTION_KEYS),
    supabase.from("pack_items").select("*").eq("report_id", reportId).order("kind").order("sort"),
  ]);
  if (!report) return null;

  const order = PACK_SECTION_KEYS;
  const docs: PackItemDoc[] = (sections ?? [])
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .flatMap((s) => splitSection(s.key, ((s.content as { blocks?: Block[] } | null)?.blocks ?? []) as Block[]));
  const jds: PackItemDoc[] = (items ?? []).filter((i) => i.kind === "jd").map((i) => ({ id: `jd-${i.id}`, kind: "jd" as const, code: i.code, title: i.title, blocks: (i.data as { blocks: Block[] }).blocks }));
  const trackers: PackTracker[] = (items ?? []).filter((i) => i.kind === "tracker").map((i) => ({ id: `tracker-${i.id}`, code: i.code, title: i.title, spec: i.data as TrackerSpec }));
  const registersSection = (sections ?? []).find((s) => s.key === "registers");

  return {
    report: report as unknown as { id: string; version: number; status: string; language: "en" | "ar"; engagement_id: string; department_id: string; departments: { name: string; code: string } },
    export: loaded,
    docs: [...docs, ...jds],
    trackers,
    hasRegisters: !!(registersSection?.content as { blocks?: unknown[] } | null)?.blocks?.length,
  };
}

type Pack = NonNullable<Awaited<ReturnType<typeof loadPack>>>;

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
export const docFileName = (d: PackItemDoc, ext: string) => safe(`${d.code} ${d.title}`) + `.${ext}`;
export const trackerFileName = (t: PackTracker) => safe(`${t.code} ${t.title}`) + ".xlsx";

export function docWordInput(pack: Pack, d: PackItemDoc) {
  const e = pack.export.input;
  return {
    language: e.language,
    approved: e.approved,
    firmName: e.firmName,
    client: e.client,
    logo: e.logo,
    departmentName: e.departmentName,
    kindLabel: DOC_KIND_LABEL[d.kind],
    code: d.code,
    title: d.title,
    version: pack.report.version,
    blocks: d.blocks,
  };
}

export function renderDocWord(pack: Pack, d: PackItemDoc) {
  return renderDocument(docWordInput(pack, d));
}

export async function renderDocPdf(pack: Pack, d: PackItemDoc, browser?: Awaited<ReturnType<typeof launchBrowser>>) {
  const w = docWordInput(pack, d);
  const clientName = w.language === "ar" && w.client.name_ar ? w.client.name_ar : w.client.name;
  const html = renderDocumentHtml({ ...w, clientName });
  const hf = documentHeaderFooter({ language: w.language, approved: w.approved, firmName: w.firmName, clientName, code: d.code, title: d.title });
  const own = !browser;
  const b = browser ?? (await launchBrowser());
  try {
    return await htmlToPdf(b, html, hf);
  } finally {
    if (own) await b.close();
  }
}

export function renderTracker(pack: Pack, t: PackTracker) {
  const e = pack.export.input;
  return buildTrackerWorkbook({ spec: t.spec, clientName: e.client.name, departmentName: e.departmentName, firmName: e.firmName, approved: e.approved, logo: e.logo });
}

/** The whole pack as a zip: full report, every document (Word, or PDF), every Excel tracker. */
export async function buildPackZip(pack: Pack, format: "docx" | "pdf") {
  const zip = new JSZip();
  const dept = safe(pack.report.departments.name);
  const root = zip.folder(dept)!;
  root.file(`${safe(pack.export.fileBase)}.docx`, await renderReport(pack.export.input));

  // register specifications are only included when no Excel trackers were built
  const docs = pack.trackers.length ? pack.docs.filter((d) => d.kind !== "register") : pack.docs;
  const browser = format === "pdf" && docs.length ? await launchBrowser() : undefined;
  try {
    for (const d of docs) {
      const folder = root.folder(FOLDER[d.kind] ?? "Documents")!;
      if (format === "pdf") folder.file(docFileName(d, "pdf"), await renderDocPdf(pack, d, browser));
      else folder.file(docFileName(d, "docx"), await renderDocWord(pack, d));
    }
  } finally {
    await browser?.close();
  }
  for (const t of pack.trackers) root.folder("Excel trackers")!.file(trackerFileName(t), await renderTracker(pack, t));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export { KIND_LABEL };
