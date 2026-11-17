import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/supabase/server";
import { RagDot, ScoreBadge } from "@/components/score-badge";
import { Questionnaire } from "./questionnaire";
import { UploadWizard } from "./upload-wizard";
import { createReport } from "../../../actions";
import { SubmitButton } from "@/components/submit-button";

export default async function DepartmentPage({ params }: { params: Promise<{ id: string; dept: string }> }) {
  const { id, dept: code } = await params;
  const { supabase } = await requireStaff();
  const { data: dept } = await supabase.from("departments").select("*").eq("code", code).single();
  if (!dept) notFound();
  const [{ data: eng }, { data: ed }, { data: questions }, { data: responses }, { data: metrics }, { data: upload }] = await Promise.all([
    supabase.from("engagements").select("id, title, clients(name)").eq("id", id).single(),
    supabase.from("engagement_departments").select("*").eq("engagement_id", id).eq("department_id", dept.id).single(),
    supabase.from("questions").select("*").eq("department_id", dept.id).order("sort"),
    supabase.from("responses").select("*").eq("engagement_id", id),
    supabase.from("metrics").select("*").eq("engagement_id", id).eq("department_id", dept.id).order("created_at"),
    supabase.from("data_uploads").select("*").eq("engagement_id", id).eq("dataset_type", "ar_ageing").maybeSingle(),
  ]);
  if (!eng || !ed) notFound();
  const clientName = (eng.clients as unknown as { name: string }).name;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/engagements/${id}`} className="text-sm text-blue-800">
          ← {clientName} · {eng.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{dept.name}</h1>
          <ScoreBadge score={ed.score === null ? null : Number(ed.score)} />
        </div>
      </div>

      <Questionnaire engagementId={id} departmentId={dept.id} questions={questions ?? []} responses={responses ?? []} />

      {(dept.supported_datasets as string[]).includes("ar_ageing") && (
        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold">Receivables data (AR ageing)</h2>
            <p className="text-sm text-gray-500">
              Upload the customer ageing report exported from the client&apos;s system (Zoho, Odoo, Tally or any Excel/CSV). You&apos;ll confirm which column is which before import.
            </p>
          </div>
          {upload && (
            <p className="text-sm text-gray-700">
              Current file: <strong>{upload.original_name}</strong> — {upload.row_count} customers imported on {new Date(upload.created_at).toLocaleDateString()}. Uploading a new file replaces it.
            </p>
          )}
          <UploadWizard engagementId={id} departmentId={dept.id} />
          {metrics && metrics.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="py-1">Metric</th>
                    <th className="py-1 text-right">Value</th>
                    <th className="py-1 pl-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-t border-gray-100">
                      <td className="py-1.5">{m.label}</td>
                      <td className="py-1.5 text-right font-medium">
                        {m.unit === "SAR" ? `SAR ${Number(m.value).toLocaleString()}` : `${Number(m.value).toLocaleString()}${m.unit === "%" ? "%" : m.unit === "days" ? " days" : ""}`}
                      </td>
                      <td className="py-1.5 pl-4">
                        <RagDot rag={m.rag} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">Generate report</h2>
        <p className="text-sm text-gray-500">
          Creates a new report version from the current answers and data. Each section is written by AI, then reviewed and approved by your team before export.
        </p>
        <form action={createReport} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="engagement_id" value={id} />
          <input type="hidden" name="department_id" value={dept.id} />
          <div>
            <label className="label">Report language</label>
            <select name="language" className="input">
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
          <SubmitButton pendingText="Creating…">Create report</SubmitButton>
        </form>
      </section>
    </div>
  );
}
