import type { SupabaseClient } from "@supabase/supabase-js";
import { MATURITY_LEVELS, computeScores, effectiveAnswers, scoreBand, type ResponseRow } from "@/lib/scoring";

export type SkeletonItem = { key: string; title: string; guidance: string; tier?: "analysis" | "template" };

/** Loads everything known about one engagement + department and turns it into the model's briefing. */
export async function buildClientContext(supabase: SupabaseClient, engagementId: string, departmentId: string) {
  const [{ data: eng }, { data: dept }, { data: questions }, { data: responses }, { data: metrics }] = await Promise.all([
    supabase.from("engagements").select("*, clients(*)").eq("id", engagementId).single(),
    supabase.from("departments").select("*").eq("id", departmentId).single(),
    supabase.from("questions").select("*").eq("department_id", departmentId).order("sort"),
    supabase.from("responses").select("*").eq("engagement_id", engagementId),
    supabase.from("metrics").select("*").eq("engagement_id", engagementId).eq("department_id", departmentId),
  ]);
  if (!eng || !dept) throw new Error("Engagement or department not found");
  const c = eng.clients;
  const qs = questions ?? [];
  const answers = effectiveAnswers((responses ?? []) as ResponseRow[]);
  const scores = computeScores(qs, answers);
  const comments = new Map<string, string[]>();
  for (const r of responses ?? []) if (r.comment) comments.set(r.question_id, [...(comments.get(r.question_id) ?? []), `${r.source}: ${r.comment}`]);

  const lines: string[] = [];
  lines.push("CLIENT PROFILE");
  lines.push(`Company: ${c.name}${c.name_ar ? ` (${c.name_ar})` : ""}`);
  if (c.industry) lines.push(`Industry: ${c.industry}`);
  if (c.business_model) lines.push(`Business model: ${c.business_model}`);
  if (c.city) lines.push(`Location: ${c.city}, Kingdom of Saudi Arabia`);
  const branches = (c.branches ?? []) as { name: string; city?: string }[];
  if (branches.length) lines.push(`Branches (${branches.length}): ${branches.map((b) => b.name + (b.city ? ` (${b.city})` : "")).join(", ")}`);
  if (c.categories?.length) lines.push(`Products / services: ${c.categories.join(", ")}`);
  if (c.headcount) lines.push(`Headcount: ${c.headcount}`);
  if (c.erp_system) lines.push(`ERP / accounting system: ${c.erp_system}`);
  const people = (c.key_people ?? []) as { name: string; position: string; responsibilities?: string }[];
  if (people.length) {
    lines.push("Key people:");
    for (const p of people) lines.push(`- ${p.name} — ${p.position}${p.responsibilities ? `: ${p.responsibilities}` : ""}`);
  }
  if (c.notes) lines.push(`Consultant notes: ${c.notes}`);
  lines.push(`Assessment date: ${eng.assessment_date} (round ${eng.round})`);

  lines.push("", `DEPARTMENT ASSESSED: ${dept.name}`);
  if (dept.report_title) lines.push(`Report title: ${dept.report_title}`);
  lines.push(
    `Overall maturity score: ${scores.score ?? "not assessed"} / 5 (${scoreBand(scores.score).label}); ${scores.answered} of ${scores.scorable} questions answered.`,
  );
  for (const [d, s] of Object.entries(scores.dimension_scores)) lines.push(`- ${d}: ${s} / 5`);

  lines.push("", "QUESTIONNAIRE ANSWERS (maturity 0 = not in place … 4 = monitored & improved)");
  for (const q of qs) {
    const v = answers.get(q.id);
    let shown = "not answered";
    if (q.answer_type === "maturity" && typeof v === "number") shown = `${v} — ${MATURITY_LEVELS[v]?.label}`;
    else if (q.answer_type === "yes_no" && typeof v === "boolean") shown = v ? "Yes" : "No";
    else if (v !== undefined && v !== null && v !== "") shown = String(v);
    lines.push(`[${q.code}] (${q.dimension}) ${q.text} → ${shown}`);
    for (const cm of comments.get(q.id) ?? []) lines.push(`    comment ${cm}`);
  }

  if (metrics?.length) {
    lines.push("", "METRICS COMPUTED FROM CLIENT DATA");
    for (const m of metrics) {
      lines.push(`- ${m.label}: ${m.value} ${m.unit}${m.rag ? ` [${m.rag.toUpperCase()}]` : ""}`);
      if (m.detail) lines.push(`    detail: ${JSON.stringify(m.detail)}`);
    }
  } else {
    lines.push("", "No client data files were uploaded for this department; do not quote figures.");
  }

  const skeleton = (dept.report_skeleton ?? []) as SkeletonItem[];
  lines.push("", "FULL REPORT OUTLINE (for consistency across sections; write only the section requested)");
  skeleton.forEach((s, i) => lines.push(`${i + 1}. ${s.title}`));

  return { text: lines.join("\n"), engagement: eng, client: c, department: dept, skeleton, scores };
}
