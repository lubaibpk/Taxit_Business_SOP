import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { designTrackers } from "@/lib/ai/pack-ai";
import { blocksToText, type Block } from "@/lib/blocks";

export const maxDuration = 300;

/** Designs the Excel trackers for a report from its approved registers chapter (replaces earlier designs). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 });

  const [{ data: report }, { data: section }] = await Promise.all([
    supabase.from("reports").select("id, engagements(clients(name, industry, erp_system, headcount, branches, key_people)), departments(name)").eq("id", id).single(),
    supabase.from("report_sections").select("content").eq("report_id", id).eq("key", "registers").maybeSingle(),
  ]);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const blocks = ((section?.content as { blocks?: Block[] } | null)?.blocks ?? []) as Block[];
  if (!blocks.length) return NextResponse.json({ error: "Write the report's Registers section first — the trackers are designed from it." }, { status: 400 });

  const r = report as unknown as {
    engagements: { clients: { name: string; industry: string | null; erp_system: string | null; headcount: number | null; branches: { name: string }[]; key_people: { name: string; position: string }[] } };
    departments: { name: string };
  };
  const c = r.engagements.clients;
  const brief = [
    `Company: ${c.name}`,
    c.industry ? `Industry: ${c.industry}` : "",
    c.erp_system ? `System: ${c.erp_system}` : "",
    c.headcount ? `Headcount: ${c.headcount}` : "",
    c.branches?.length ? `Branches: ${c.branches.map((b) => b.name).join(", ")}` : "",
    c.key_people?.length ? `People: ${c.key_people.map((p) => `${p.name} (${p.position})`).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const specs = await designTrackers({ clientBrief: brief, registersText: blocksToText(blocks), department: r.departments.name });
    if (!specs.length) throw new Error("No trackers could be designed from the Registers section.");
    await supabase.from("pack_items").delete().eq("report_id", id).eq("kind", "tracker");
    const { error } = await supabase
      .from("pack_items")
      .insert(specs.map((s, i) => ({ report_id: id, kind: "tracker", code: s.code, title: s.title, data: s, sort: i, created_by: user.id })));
    if (error) throw new Error(error.message);
    return NextResponse.json({ count: specs.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Tracker design failed" }, { status: 500 });
  }
}
