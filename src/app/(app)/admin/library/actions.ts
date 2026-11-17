"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/server";
import { DEPARTMENT_LIBRARY } from "@/lib/departments";
import { writeDepartments } from "@/lib/departments/sync";
import { buildQuestions, buildSkeleton } from "@/lib/departments/build";
import { normaliseDraft, type DepartmentDraft } from "@/lib/ai/design-department";

/** Writes the in-code department library to the database. Safe to run again: it updates in place. */
export async function syncDepartmentLibrary() {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") throw new Error("Admins only");
  const results = await writeDepartments(supabase, DEPARTMENT_LIBRARY.map((d) => d.code));
  revalidatePath("/admin/library");
  return results;
}

/** Saves a reviewed department draft as a new custom department with its outline and questionnaire. */
export async function saveCustomDepartment(raw: DepartmentDraft) {
  const { supabase } = await requireStaff();
  const draft = normaliseDraft(raw as unknown as Record<string, unknown>);
  if (!draft.name) throw new Error("Department name is required");
  if (draft.frameworks.length < 2) throw new Error("Add at least two report sections");
  if (!draft.questions.some((q) => q.answer_type !== "text")) throw new Error("Add at least one maturity question");

  const base = draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "custom";
  const { data: existing } = await supabase.from("departments").select("code, sort").order("sort", { ascending: false });
  const codes = new Set((existing ?? []).map((d) => d.code));
  let code = `custom_${base}`;
  for (let i = 2; codes.has(code); i++) code = `custom_${base}_${i}`;
  const sort = Math.max(200, ...(existing ?? []).map((d) => d.sort)) + 10;

  const def = { ...draft, code, sort };
  const { data: dept, error } = await supabase
    .from("departments")
    .insert({
      code,
      name: def.name,
      name_ar: def.name_ar || null,
      description: def.description,
      report_title: def.report_title,
      is_custom: true,
      sort,
      report_skeleton: buildSkeleton(def),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: qErr } = await supabase.from("questions").insert(buildQuestions(def).map((q) => ({ ...q, department_id: dept.id })));
  if (qErr) {
    await supabase.from("departments").delete().eq("id", dept.id);
    throw new Error(qErr.message);
  }
  revalidatePath("/admin/library");
  return { id: dept.id, code };
}

/** Deletes a custom department that no assessment uses yet. */
export async function deleteCustomDepartment(id: string) {
  const { supabase } = await requireStaff();
  const { data: dept } = await supabase.from("departments").select("is_custom").eq("id", id).single();
  if (!dept?.is_custom) throw new Error("Only custom departments can be deleted");
  const { count } = await supabase.from("engagement_departments").select("id", { count: "exact", head: true }).eq("department_id", id);
  if (count) throw new Error("This department is used in an assessment and cannot be deleted");
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/library");
}
