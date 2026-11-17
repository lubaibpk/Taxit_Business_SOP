"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/supabase/server";
import { DEPARTMENT_LIBRARY } from "@/lib/departments";
import { writeDepartments } from "@/lib/departments/sync";

/** Writes the in-code department library to the database. Safe to run again: it updates in place. */
export async function syncDepartmentLibrary() {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") throw new Error("Admins only");
  const results = await writeDepartments(supabase, DEPARTMENT_LIBRARY.map((d) => d.code));
  revalidatePath("/admin/library");
  return results;
}
