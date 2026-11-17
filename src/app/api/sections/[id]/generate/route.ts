import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildClientContext } from "@/lib/report-context";
import { sectionTier, writeSection } from "@/lib/ai/write-section";
import { blocksToText, type Block } from "@/lib/blocks";

// 300s is the Vercel Hobby limit; on a Pro plan raise this to 800 for the longest sections (SOPs, policies)
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { instructions?: string; revise?: boolean };
  const { data: section } = await supabase.from("report_sections").select("*, reports(*)").eq("id", id).single();
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  const report = section.reports;

  await supabase.from("report_sections").update({ status: "generating", error: null, instructions: body.instructions ?? null }).eq("id", id);

  try {
    const ctx = await buildClientContext(supabase, report.engagement_id, report.department_id);
    const item = ctx.skeleton.find((s) => s.key === section.key);
    const existing = (section.content?.blocks ?? []) as Block[];
    const blocks = await writeSection({
      tier: sectionTier(section.key, item?.tier),
      language: report.language,
      clientContext: ctx.text,
      sectionTitle: section.title,
      sectionNumber: section.sort,
      guidance: item?.guidance ?? section.title,
      instructions: body.instructions,
      previousText: body.revise && existing.length ? blocksToText(existing) : null,
    });
    await supabase
      .from("report_sections")
      .update({ content: { blocks }, status: "draft", generated_at: new Date().toISOString(), updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (report.status === "approved") await supabase.from("reports").update({ status: "in_review", approved_by: null, approved_at: null }).eq("id", report.id);
    return NextResponse.json({ blocks });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed";
    await supabase.from("report_sections").update({ status: existingStatus(section), error: message }).eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function existingStatus(section: { content: { blocks?: unknown[] } | null }) {
  return section.content?.blocks?.length ? "draft" : "error";
}
