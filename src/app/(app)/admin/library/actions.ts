"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/server";
import { DEPARTMENT_LIBRARY } from "@/lib/departments";
import { buildQuestions, buildSkeleton } from "@/lib/departments/build";

/** Writes the in-code department library to the database. Safe to run again: it updates in place. */
export async function syncDepartmentLibrary() {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") throw new Error("Admins only");

  const results: { code: string; questions: number }[] = [];
  for (const d of DEPARTMENT_LIBRARY) {
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
  revalidatePath("/admin/library");
  return results;
}
