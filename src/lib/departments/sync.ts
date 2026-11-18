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
 * Loads library departments that are missing or out of date in the database.
 * Called on page load for staff, so new and updated outlines apply without a manual step.
 */
export async function ensureDepartmentsLoaded(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("departments").select("code, report_skeleton");
  if (error) return;
  // Postgres reorders JSON object keys, so compare with keys sorted
  const canonical = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(canonical).join(",")}]`
      : v && typeof v === "object"
        ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`
        : JSON.stringify(v);
  const current = new Map((data ?? []).map((d) => [d.code, canonical(d.report_skeleton)]));
  // load departments that are missing, and refresh any whose outline changed in a new app version
  const stale = DEPARTMENT_LIBRARY.filter((d) => current.get(d.code) !== canonical(buildSkeleton(d))).map((d) => d.code);
  if (!stale.length) return;
  try {
    await writeDepartments(supabase, stale);
  } catch (e) {
    console.error("Department library auto-load failed:", e);
  }
}
