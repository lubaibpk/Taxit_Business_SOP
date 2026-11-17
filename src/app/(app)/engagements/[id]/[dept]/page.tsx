import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { RagDot, ScoreBadge } from "@/components/score-badge";
import { PageHeader, Pill, REPORT_STATUS, Steps } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deptSteps, loadEngagementProgress } from "@/lib/progress";
import { Questionnaire } from "./questionnaire";
import { UploadWizard } from "./upload-wizard";
import { createReport } from "../../../actions";

type Step = "questions" | "data" | "report";

export default async function DepartmentPage({ params, searchParams }: { params: Promise<{ id: string; dept: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id, dept: code } = await params;
  const { step: rawStep } = await searchParams;
  const { supabase } = await requireStaff();
  const { data: dept } = await supabase.from("departments").select("*").eq("code", code).single();
  if (!dept) notFound();
  const [{ data: eng }, progress, { data: questions }, { data: responses }, { data: metrics }, { data: upload }] = await Promise.all([
    supabase.from("engagements").select("id, title, round, clients(id, name)").eq("id", id).single(),
    loadEngagementProgress(supabase, id),
    supabase.from("questions").select("*").eq("department_id", dept.id).order("sort"),
    supabase.from("responses").select("*").eq("engagement_id", id),
    supabase.from("metrics").select("*").eq("engagement_id", id).eq("department_id", dept.id).order("created_at"),
    supabase.from("data_uploads").select("*").eq("engagement_id", id).eq("dataset_type", "ar_ageing").maybeSingle(),
  ]);
  const p = progress.find((x) => x.departmentId === dept.id);
  if (!eng || !p) notFound();
  const client = eng.clients as unknown as { id: string; name: string };
  const hasData = (dept.supported_datasets as string[]).length > 0;

  const step: Step = rawStep === "data" && hasData ? "data" : rawStep === "report" ? "report" : rawStep === "questions" ? "questions" : p.answered < p.questions ? "questions" : hasData && !p.dataUploaded ? "data" : "report";
  const base = `/engagements/${id}/${code}`;
  const tabs: { key: Step; label: string }[] = [
    { key: "questions", label: `1. Questionnaire (${p.answered}/${p.questions})` },
    ...(hasData ? [{ key: "data" as Step, label: `2. Client data${p.dataUploaded ? " ✓" : ""}` }] : []),
    { key: "report", label: `${hasData ? 3 : 2}. Report` },
  ];
  const afterQuestions = hasData ? `${base}?step=data` : `${base}?step=report`;

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { href: "/clients", label: "Clients" },
          { href: `/clients/${client.id}`, label: client.name },
          { href: `/engagements/${id}`, label: eng.title },
        ]}
        title={dept.name}
        subtitle={dept.description}
        actions={<ScoreBadge score={p.score} />}
      />

      <div className="card p-3">
        <Steps steps={deptSteps(p, id)} />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${base}?step=${t.key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${step === t.key ? "border-brand font-medium text-brand" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {step === "questions" && <Questionnaire engagementId={id} departmentId={dept.id} questions={questions ?? []} responses={responses ?? []} nextHref={afterQuestions} />}

      {step === "data" && hasData && (
        <section className="space-y-4">
          <div className="card space-y-4">
            <div>
              <h2 className="font-medium">Receivables data (AR ageing)</h2>
              <p className="text-sm text-gray-500">
                Optional but recommended: real figures make the report specific. Upload the customer ageing report from the client&apos;s system (Zoho, Odoo, Tally or any Excel/CSV). You&apos;ll confirm the columns before import.
              </p>
            </div>
            {upload && (
              <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
                Using <strong>{upload.original_name}</strong> — {upload.row_count} customers, imported {new Date(upload.created_at).toLocaleDateString()}. Uploading a new file replaces it.
              </div>
            )}
            <UploadWizard engagementId={id} departmentId={dept.id} />
          </div>
          {metrics && metrics.length > 0 && (
            <div className="card p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Metric</th>
                    <th className="px-5 py-2.5 text-right font-medium">Value</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-t border-gray-50">
                      <td className="px-5 py-2">{m.label}</td>
                      <td className="px-5 py-2 text-right font-medium">
                        {m.unit === "SAR" ? `SAR ${Number(m.value).toLocaleString()}` : `${Number(m.value).toLocaleString()}${m.unit === "%" ? "%" : m.unit === "days" ? " days" : ""}`}
                      </td>
                      <td className="px-5 py-2">
                        <RagDot rag={m.rag} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end">
            <Link href={`${base}?step=report`} className="btn">
              {upload ? "Next: report →" : "Skip, go to report →"}
            </Link>
          </div>
        </section>
      )}

      {step === "report" && (
        <section className="space-y-4">
          {p.answered < p.questions && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {p.questions - p.answered} question{p.questions - p.answered === 1 ? " is" : "s are"} still unanswered. You can create the report now, but unanswered areas will be treated as unknown.{" "}
              <Link href={`${base}?step=questions`} className="font-medium underline">
                Finish the questionnaire
              </Link>
            </div>
          )}
          {p.reports.length > 0 && (
            <div className="card divide-y divide-gray-100 p-0">
              {p.reports.map((r) => (
                <Link key={r.id} href={`/reports/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50">
                  <span className="text-sm font-medium">
                    {r.language === "ar" ? "Arabic" : "English"} report · v{r.version}
                  </span>
                  <span className="flex items-center gap-3">
                    <Pill tone={REPORT_STATUS[r.status].tone}>{REPORT_STATUS[r.status].label}</Pill>
                    <span className="text-xs font-medium text-brand">Open →</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
          <form action={createReport} className="card flex flex-wrap items-end gap-4">
            <input type="hidden" name="engagement_id" value={id} />
            <input type="hidden" name="department_id" value={dept.id} />
            <div className="min-w-64 flex-1">
              <h2 className="font-medium">{p.reports.length ? "Create a new version" : "Create the report"}</h2>
              <p className="text-xs text-gray-500">Uses the current answers and data. AI writes each section; your team reviews and approves before export.</p>
            </div>
            <div>
              <label className="label">Language</label>
              <select name="language" className="input">
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
            <SubmitButton pendingText="Creating…">Create report</SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
