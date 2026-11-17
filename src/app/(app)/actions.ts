"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { computeScores, effectiveAnswers, type ResponseRow } from "@/lib/scoring";
import { readSheet } from "@/lib/datasets/read-sheet";
import { computeArMetrics, detectHeaderRow, normaliseRows, suggestMap, type ColumnMap } from "@/lib/datasets/ar-ageing";
import { textToBlocks } from "@/lib/blocks";
import type { SkeletonItem } from "@/lib/report-context";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

// ───────────────────────── Clients ─────────────────────────

export async function saveClient(form: FormData) {
  const { supabase, user } = await requireStaff();
  const id = str(form, "id");
  const branches = (str(form, "branches") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, city] = l.split(",").map((s) => s.trim());
      return { name, city: city || null };
    });
  const key_people = (str(form, "key_people") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, position, responsibilities] = l.split(/\s+[—–-]\s+|\s*\|\s*/).map((s) => s?.trim());
      return { name, position: position ?? "", responsibilities: responsibilities ?? "" };
    });
  const row = {
    name: str(form, "name")!,
    name_ar: str(form, "name_ar"),
    cr_number: str(form, "cr_number"),
    vat_number: str(form, "vat_number"),
    industry: str(form, "industry"),
    business_model: str(form, "business_model"),
    city: str(form, "city"),
    address: str(form, "address"),
    headcount: str(form, "headcount") ? Number(str(form, "headcount")) : null,
    erp_system: str(form, "erp_system"),
    categories: (str(form, "categories") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    branches,
    key_people,
    notes: str(form, "notes"),
  };
  if (!row.name) throw new Error("Client name is required");

  let clientId = id;
  if (id) {
    const { error } = await supabase.from("clients").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.from("clients").insert({ ...row, created_by: user.id }).select("id").single();
    if (error) throw new Error(error.message);
    clientId = data.id;
  }

  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!/^image\/(png|jpeg)$/.test(logo.type)) throw new Error("Logo must be a PNG or JPG image");
    if (logo.size > 2_000_000) throw new Error("Logo must be under 2 MB");
    const ext = logo.type === "image/png" ? "png" : "jpg";
    const path = `${clientId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, logo, { contentType: logo.type, upsert: true });
    if (error) throw new Error(error.message);
    await supabase.from("clients").update({ logo_path: path }).eq("id", clientId!);
  }

  revalidatePath("/");
  redirect(`/clients/${clientId}`);
}

export async function createEngagement(form: FormData) {
  const { supabase, user } = await requireStaff();
  const clientId = str(form, "client_id")!;
  const deptIds = form.getAll("departments").map(String);
  if (!deptIds.length) throw new Error("Pick at least one department");
  const { count } = await supabase.from("engagements").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  const { data, error } = await supabase
    .from("engagements")
    .insert({
      client_id: clientId,
      title: str(form, "title") ?? "Business assessment",
      assessment_date: str(form, "assessment_date") ?? new Date().toISOString().slice(0, 10),
      round: (count ?? 0) + 1,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from("engagement_departments").insert(deptIds.map((d) => ({ engagement_id: data.id, department_id: d })));
  if (e2) throw new Error(e2.message);
  redirect(`/engagements/${data.id}`);
}

/** Deletes an assessment that has no reports (reports are deliverables and are never deleted this way). */
export async function deleteEngagement(id: string, clientId: string) {
  const { supabase } = await requireStaff();
  const { count } = await supabase.from("reports").select("id", { count: "exact", head: true }).eq("engagement_id", id);
  if (count) throw new Error("This assessment has reports and cannot be deleted.");
  const { error } = await supabase.from("engagements").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export async function addDepartmentToEngagement(form: FormData) {
  const { supabase } = await requireStaff();
  const engagementId = str(form, "engagement_id")!;
  const deptId = str(form, "department_id")!;
  await supabase.from("engagement_departments").upsert({ engagement_id: engagementId, department_id: deptId }, { onConflict: "engagement_id,department_id" });
  revalidatePath(`/engagements/${engagementId}`);
}

// ───────────────────────── Questionnaire ─────────────────────────

export type AnswerInput = { question_id: string; value: unknown; comment: string | null };

export async function saveResponses(engagementId: string, departmentId: string, source: "consultant" | "client", respondent: string | null, answers: AnswerInput[]) {
  const { supabase, user } = await requireStaff();
  const rows = answers.map((a) => ({
    engagement_id: engagementId,
    question_id: a.question_id,
    source,
    value: a.value === undefined || a.value === "" ? null : a.value,
    comment: a.comment || null,
    respondent,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("responses").upsert(rows, { onConflict: "engagement_id,question_id,source" });
  if (error) throw new Error(error.message);
  await rescore(engagementId, departmentId);
  revalidatePath(`/engagements/${engagementId}`);
  return { ok: true };
}

/** Saves the consultant's free-text findings for one department of an assessment. */
export async function saveFindings(engagementId: string, departmentId: string, findings: string) {
  const { supabase } = await requireStaff();
  const { error } = await supabase
    .from("engagement_departments")
    .update({ findings: findings.trim() || null, findings_updated_at: new Date().toISOString() })
    .eq("engagement_id", engagementId)
    .eq("department_id", departmentId);
  if (error) throw new Error(error.message);
  revalidatePath(`/engagements/${engagementId}`);
}

async function rescore(engagementId: string, departmentId: string) {
  const { supabase } = await requireStaff();
  const [{ data: qs }, { data: rs }] = await Promise.all([
    supabase.from("questions").select("id, dimension, weight, answer_type").eq("department_id", departmentId),
    supabase.from("responses").select("question_id, source, value").eq("engagement_id", engagementId),
  ]);
  const s = computeScores(qs ?? [], effectiveAnswers((rs ?? []) as ResponseRow[]));
  await supabase
    .from("engagement_departments")
    .update({ score: s.score, dimension_scores: s.dimension_scores, scored_at: new Date().toISOString() })
    .eq("engagement_id", engagementId)
    .eq("department_id", departmentId);
}

// ───────────────────────── Data upload (AR ageing) ─────────────────────────

export async function previewUpload(form: FormData) {
  await requireStaff();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file first");
  const grid = await readSheet(file);
  if (!grid.length) throw new Error("The file looks empty");
  const headerRow = detectHeaderRow(grid);
  const headers = (grid[headerRow] ?? []).map((h) => String(h ?? "").trim());
  return {
    headerRow,
    headers,
    sample: grid.slice(headerRow + 1, headerRow + 6).map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
    map: suggestMap(headers),
    totalRows: grid.length - headerRow - 1,
  };
}

export async function importUpload(form: FormData) {
  const { supabase, user } = await requireStaff();
  const engagementId = str(form, "engagement_id")!;
  const departmentId = str(form, "department_id")!;
  const file = form.get("file") as File;
  const headerRow = Number(str(form, "header_row") ?? 0);
  const map = JSON.parse(str(form, "map") ?? "{}") as ColumnMap;
  const annualSales = str(form, "annual_credit_sales") ? Number(str(form, "annual_credit_sales")!.replace(/,/g, "")) : null;
  if (!Object.values(map).includes("customer_name")) throw new Error("Map one column to Customer name");

  const grid = await readSheet(file);
  const rows = normaliseRows(grid, headerRow, map);
  if (!rows.length) throw new Error("No customer rows with balances were found with this mapping");

  const path = `${engagementId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (upErr) throw new Error(upErr.message);

  // one AR ageing per engagement: replace the previous one
  await supabase.from("data_uploads").delete().eq("engagement_id", engagementId).eq("dataset_type", "ar_ageing");
  const { data: upload, error } = await supabase
    .from("data_uploads")
    .insert({
      engagement_id: engagementId,
      dataset_type: "ar_ageing",
      file_path: path,
      original_name: file.name,
      column_map: map,
      params: { header_row: headerRow, annual_credit_sales: annualSales },
      row_count: rows.length,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await supabase.from("dataset_rows").insert(rows.slice(i, i + 500).map((data) => ({ upload_id: upload.id, data })));
    if (e) throw new Error(e.message);
  }
  const metrics = computeArMetrics(rows, annualSales);
  await supabase.from("metrics").delete().eq("engagement_id", engagementId).eq("department_id", departmentId);
  const { error: mErr } = await supabase
    .from("metrics")
    .insert(metrics.map((m) => ({ ...m, engagement_id: engagementId, department_id: departmentId, upload_id: upload.id })));
  if (mErr) throw new Error(mErr.message);
  revalidatePath(`/engagements/${engagementId}`);
  return { rows: rows.length };
}

// ───────────────────────── Reports ─────────────────────────

export async function createReport(form: FormData) {
  const { supabase, user } = await requireStaff();
  const engagementId = str(form, "engagement_id")!;
  const departmentId = str(form, "department_id")!;
  const language = str(form, "language") === "ar" ? "ar" : "en";
  const { data: dept } = await supabase.from("departments").select("report_skeleton").eq("id", departmentId).single();
  const skeleton = (dept?.report_skeleton ?? []) as SkeletonItem[];
  if (!skeleton.length) throw new Error("This department has no report outline yet");
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("engagement_id", engagementId)
    .eq("department_id", departmentId)
    .eq("language", language);
  const { data: report, error } = await supabase
    .from("reports")
    .insert({ engagement_id: engagementId, department_id: departmentId, language, version: (count ?? 0) + 1, created_by: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase
    .from("report_sections")
    .insert(skeleton.map((s, i) => ({ report_id: report.id, key: s.key, title: s.title, sort: i + 1 })));
  if (e2) throw new Error(e2.message);
  redirect(`/reports/${report.id}`);
}

export async function saveSectionText(sectionId: string, text: string) {
  const { supabase, user } = await requireStaff();
  const blocks = textToBlocks(text);
  const { error } = await supabase
    .from("report_sections")
    .update({ content: { blocks }, status: "draft", updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
  await reopenReport(sectionId);
  return { blocks };
}

export async function setSectionStatus(sectionId: string, status: "draft" | "in_review" | "approved") {
  const { supabase, user, profile } = await requireStaff();
  if (status === "approved" && !["admin", "reviewer"].includes(profile.role)) throw new Error("Only reviewers can approve sections");
  const { error } = await supabase.from("report_sections").update({ status, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", sectionId);
  if (error) throw new Error(error.message);
  if (status !== "approved") await reopenReport(sectionId);
}

/** Any change to a section of an approved report puts the report back into review. */
async function reopenReport(sectionId: string) {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("report_sections").select("report_id").eq("id", sectionId).single();
  if (data) await supabase.from("reports").update({ status: "in_review", approved_by: null, approved_at: null }).eq("id", data.report_id).eq("status", "approved");
}

export async function addComment(sectionId: string, body: string) {
  const { supabase, user } = await requireStaff();
  if (!body.trim()) return;
  const { error } = await supabase.from("section_comments").insert({ section_id: sectionId, author: user.id, body: body.trim() });
  if (error) throw new Error(error.message);
}

export async function setReportStatus(reportId: string, status: "draft" | "in_review" | "approved") {
  const { supabase, user, profile } = await requireStaff();
  if (status === "approved") {
    if (!["admin", "reviewer"].includes(profile.role)) throw new Error("Only reviewers can approve reports");
    const { data: secs } = await supabase.from("report_sections").select("status").eq("report_id", reportId);
    if (!secs?.length || secs.some((s) => s.status !== "approved")) throw new Error("Approve every section before approving the report");
  }
  const { error } = await supabase
    .from("reports")
    .update(status === "approved" ? { status, approved_by: user.id, approved_at: new Date().toISOString() } : { status, approved_by: null, approved_at: null })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
  revalidatePath(`/reports/${reportId}`);
}

// ───────────────────────── Team ─────────────────────────

export async function setUserRole(form: FormData) {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") throw new Error("Admins only");
  const id = str(form, "id")!;
  const role = str(form, "role")!;
  if (id === profile.id) throw new Error("You cannot change your own role");
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
