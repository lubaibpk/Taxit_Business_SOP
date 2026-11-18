import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeJobDescriptions } from "@/lib/ai/pack-ai";
import { blocksToText, type Block } from "@/lib/blocks";

export const maxDuration = 300;

// Chapters the JDs draw from: roles, controls and procedures.
const SOURCE_KEYS = ["governance", "sops", "policies", "dashboard", "approval", "org_structure", "team_structure", "structure"];

/** Writes job descriptions for the department's key roles from the report (replaces earlier JDs). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 });

  const [{ data: report }, { data: sections }] = await Promise.all([
    supabase.from("reports").select("id, language, engagements(clients(name, industry, headcount, branches, key_people)), departments(name, code)").eq("id", id).single(),
    supabase.from("report_sections").select("key, title, content, sort").eq("report_id", id).order("sort"),
  ]);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const r = report as unknown as {
    language: "en" | "ar";
    engagements: { clients: { name: string; industry: string | null; headcount: number | null; branches: { name: string }[]; key_people: { name: string; position: string; responsibilities?: string }[] } };
    departments: { name: string; code: string };
  };
  const source = (sections ?? []).filter((s) => SOURCE_KEYS.includes(s.key) && (s.content as { blocks?: Block[] } | null)?.blocks?.length);
  if (!source.length) return NextResponse.json({ error: "Write the report's governance and SOP sections first — the job descriptions are based on them." }, { status: 400 });
  const reportText = source.map((s) => `## ${s.title}\n${blocksToText((s.content as { blocks: Block[] }).blocks)}`).join("\n\n").slice(0, 120000);
  const c = r.engagements.clients;
  const brief = [
    `Company: ${c.name}`,
    c.industry ? `Industry: ${c.industry}` : "",
    c.headcount ? `Headcount: ${c.headcount}` : "",
    c.branches?.length ? `Branches: ${c.branches.map((b) => b.name).join(", ")}` : "",
    c.key_people?.length ? `Key people:\n${c.key_people.map((p) => `- ${p.name} — ${p.position}${p.responsibilities ? `: ${p.responsibilities}` : ""}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const jds = await writeJobDescriptions({ clientBrief: brief, reportText, department: r.departments.name, language: r.language });
    if (!jds.length) throw new Error("No job descriptions were produced.");
    await supabase.from("pack_items").delete().eq("report_id", id).eq("kind", "jd");
    const prefix = r.departments.code.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "JD";
    const { error } = await supabase.from("pack_items").insert(
      jds.map((j, i) => ({
        report_id: id,
        kind: "jd",
        code: `JD ${prefix}-${String(i + 1).padStart(2, "0")}`,
        title: j.person ? `${j.role} — ${j.person}` : j.role,
        data: { blocks: j.blocks },
        sort: i,
        created_by: user.id,
      })),
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ count: jds.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Writing job descriptions failed" }, { status: 500 });
  }
}
