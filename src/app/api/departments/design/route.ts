import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { designDepartment } from "@/lib/ai/design-department";

export const maxDuration = 300;

/** Returns an AI-designed department draft for the user to review before saving. Nothing is saved here. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "pending") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as { name?: string; scope?: string; industry?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Enter a department name" }, { status: 400 });
  try {
    const draft = await designDepartment({ name, scope: body.scope?.trim(), industry: body.industry?.trim() });
    return NextResponse.json({ draft });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Design failed" }, { status: 500 });
  }
}
