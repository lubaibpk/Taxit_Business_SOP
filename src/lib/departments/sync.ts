import type { SupabaseClient } from "@supabase/supabase-js";
import { DEPARTMENT_LIBRARY } from "./index";
import { buildQuestions, buildSkeleton } from "./build";

/** Writes the given library departments (outline + questions) to the database, updating in place. */
export async function writeDepartments(supabase: SupabaseClient, codes: string[]) {
  const results: { code: string; questions: number }[] = [];
  for (const d of DEPARTMENT_LIBRARY.filter((x) => codes.includes(x.code))) {
    const { data: dept, error } = await supabase
      .from("departments")
      .upsert(
        {
          code: d.code,
          name: d.name,
          name_ar: d.name_ar,
          description: d.description,
          report_title: d.report_title,
          sort: d.sort,
          report_skeleton: buildSkeleton(d),
        },
        { onConflict: "code" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`${d.name}: ${error.message}`);

    const rows = buildQuestions(d).map((q) => ({ ...q, department_id: dept.id }));
    const { error: qErr } = await supabase.from("questions").upsert(rows, { onConflict: "department_id,code" });
    if (qErr) throw new Error(`${d.name} questions: ${qErr.message}`);
    results.push({ code: d.code, questions: rows.length });
  }
  return results;
}

/**
 * Loads any library department that is still empty in the database (no outline yet).
 * Called on page load for staff, so newly deployed departments appear without a manual step.
 */
export async function ensureDepartmentsLoaded(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("departments").select("code, report_skeleton");
  if (error) return;
  const loaded = new Set((data ?? []).filter((d) => (d.report_skeleton as unknown[]).length > 0).map((d) => d.code));
  const missing = DEPARTMENT_LIBRARY.map((d) => d.code).filter((c) => !loaded.has(c));
  if (!missing.length) return;
  try {
    await writeDepartments(supabase, missing);
  } catch (e) {
    console.error("Department library auto-load failed:", e);
  }
}
