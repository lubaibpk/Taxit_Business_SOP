import type { SupabaseClient } from "@supabase/supabase-js";

/** Where each department of an assessment stands, and what the user should do next. */
export type DeptProgress = {
  departmentId: string;
  code: string;
  name: string;
  description: string | null;
  score: number | null;
  dimensionScores: Record<string, number> | null;
  answered: number;
  questions: number;
  dataSupported: boolean;
  dataUploaded: boolean;
  findings: string | null;
  findingsUpdatedAt: string | null;
  latestReport: { id: string; status: string; language: string; version: number; written: number; approved: number; total: number } | null;
  reports: { id: string; status: string; language: string; version: number }[];
  next: { label: string; href: string };
};

export async function loadEngagementProgress(supabase: SupabaseClient, engagementId: string): Promise<DeptProgress[]> {
  const [{ data: eds }, { data: responses }, { data: uploads }, { data: reports }] = await Promise.all([
    supabase
      .from("engagement_departments")
      .select("score, dimension_scores, findings, findings_updated_at, departments(id, code, name, description, supported_datasets, sort, questions(id, answer_type, weight))")
      .eq("engagement_id", engagementId),
    supabase.from("responses").select("question_id, value").eq("engagement_id", engagementId),
    supabase.from("data_uploads").select("dataset_type").eq("engagement_id", engagementId),
    supabase
      .from("reports")
      .select("id, department_id, status, language, version, created_at, report_sections(status, content)")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: false }),
  ]);

  const answeredIds = new Set((responses ?? []).filter((r) => r.value !== null).map((r) => r.question_id));
  const uploaded = new Set((uploads ?? []).map((u) => u.dataset_type));

  type Ed = {
    score: number | null;
    dimension_scores: Record<string, number> | null;
    findings: string | null;
    findings_updated_at: string | null;
    departments: { id: string; code: string; name: string; description: string | null; supported_datasets: string[]; sort: number; questions: { id: string; answer_type: string; weight: number }[] };
  };

  return ((eds ?? []) as unknown as Ed[])
    .sort((a, b) => a.departments.sort - b.departments.sort)
    .map((ed) => {
      const d = ed.departments;
      const scorable = d.questions.filter((q) => q.answer_type === "maturity" && Number(q.weight) > 0);
      const answered = scorable.filter((q) => answeredIds.has(q.id)).length;
      const dataSupported = d.supported_datasets.length > 0;
      const dataUploaded = d.supported_datasets.some((t) => uploaded.has(t));
      const deptReports = (reports ?? []).filter((r) => r.department_id === d.id);
      const latest = deptReports[0];
      const secs = (latest?.report_sections ?? []) as { status: string; content: { blocks?: unknown[] } | null }[];
      const latestReport = latest
        ? {
            id: latest.id,
            status: latest.status,
            language: latest.language,
            version: latest.version,
            written: secs.filter((s) => s.content?.blocks?.length).length,
            approved: secs.filter((s) => s.status === "approved").length,
            total: secs.length,
          }
        : null;

      const base = `/engagements/${engagementId}/${d.code}`;
      let next: DeptProgress["next"];
      if (answered < scorable.length) next = { label: answered ? "Continue questionnaire" : "Start questionnaire", href: `${base}?step=questions` };
      else if (!latestReport && !ed.findings) next = { label: "Add your findings", href: `${base}?step=notes` };
      else if (!latestReport) next = { label: dataSupported && !dataUploaded ? "Upload data or create report" : "Create report", href: `${base}?step=${dataSupported && !dataUploaded ? "data" : "report"}` };
      else if (latestReport.written < latestReport.total) next = { label: "Write report sections", href: `/reports/${latestReport.id}` };
      else if (latestReport.status !== "approved") next = { label: "Review & approve", href: `/reports/${latestReport.id}` };
      else next = { label: "Open document pack", href: `/reports/${latestReport.id}/pack` };

      return {
        departmentId: d.id,
        code: d.code,
        name: d.name,
        description: d.description,
        score: ed.score === null ? null : Number(ed.score),
        dimensionScores: ed.dimension_scores,
        answered,
        questions: scorable.length,
        dataSupported,
        dataUploaded,
        findings: ed.findings,
        findingsUpdatedAt: ed.findings_updated_at,
        latestReport,
        reports: deptReports.map((r) => ({ id: r.id, status: r.status, language: r.language, version: r.version })),
        next,
      };
    });
}

/** Step states used by the step indicator for one department. */
export function deptSteps(p: DeptProgress, engagementId: string) {
  const base = `/engagements/${engagementId}/${p.code}`;
  const qDone = p.questions > 0 && p.answered >= p.questions;
  const r = p.latestReport;
  const written = !!r && r.written === r.total && r.total > 0;
  const approved = r?.status === "approved";
  type S = "done" | "current" | "todo" | "skip";
  const steps: { label: string; state: S; href?: string; detail?: string }[] = [
    { label: "Questionnaire", state: qDone ? "done" : "current", href: `${base}?step=questions`, detail: `${p.answered}/${p.questions} answered` },
  ];
  steps.push({ label: "Your findings", state: p.findings ? "done" : qDone ? "current" : "todo", href: `${base}?step=notes`, detail: p.findings ? "Added" : "Optional" });
  if (p.dataSupported)
    steps.push({ label: "Client data", state: p.dataUploaded ? "done" : qDone ? "current" : "todo", href: `${base}?step=data`, detail: p.dataUploaded ? "Uploaded" : "Optional" });
  steps.push(
    { label: "Report", state: written ? "done" : qDone ? "current" : "todo", href: r ? `/reports/${r.id}` : `${base}?step=report`, detail: r ? `${r.written}/${r.total} written` : "Not created" },
    { label: "Approval", state: approved ? "done" : written ? "current" : "todo", href: r ? `/reports/${r.id}` : undefined, detail: r ? `${r.approved}/${r.total} approved` : undefined },
    { label: "Document pack", state: approved ? "current" : "todo", href: r ? `/reports/${r.id}/pack` : undefined, detail: "Files & trackers" },
  );
  return steps;
}
