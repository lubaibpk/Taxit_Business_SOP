"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AR_FIELDS, type ColumnMap } from "@/lib/datasets/ar-ageing";
import { importUpload, previewUpload } from "../../../actions";

type Preview = Awaited<ReturnType<typeof previewUpload>>;

export function UploadWizard({ engagementId, departmentId }: { engagementId: string; departmentId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [map, setMap] = useState<ColumnMap>({});
  const [sales, setSales] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function readFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setMsg(null);
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    start(async () => {
      try {
        const p = await previewUpload(fd);
        setPreview(p);
        setMap(p.map);
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  function doImport() {
    if (!file || !preview) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("engagement_id", engagementId);
    fd.append("department_id", departmentId);
    fd.append("header_row", String(preview.headerRow));
    fd.append("map", JSON.stringify(map));
    fd.append("annual_credit_sales", sales);
    start(async () => {
      try {
        const r = await importUpload(fd);
        setMsg(`Imported ${r.rows} customers. Metrics updated.`);
        setPreview(null);
        setFile(null);
        router.refresh();
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <input type="file" accept=".xlsx,.csv" className="text-sm" onChange={(e) => readFile(e.target.files?.[0] ?? null)} />
      {busy && !preview && <p className="text-sm text-gray-500">Reading file…</p>}
      {preview && (
        <div className="space-y-4 rounded-md border border-gray-200 p-4">
          <p className="text-sm text-gray-600">
            Found {preview.totalRows} data rows under the header on row {preview.headerRow + 1}. Check what each column means — columns mapped to the same ageing bucket are added together.
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="min-w-36 px-2 pb-2 text-left align-bottom">
                      <div className="mb-1 font-medium text-gray-800">{h || `Column ${i + 1}`}</div>
                      <select
                        className="input py-1 text-xs"
                        value={map[i] ?? ""}
                        onChange={(e) => setMap((m) => ({ ...m, [i]: e.target.value as ColumnMap[number] }))}
                      >
                        <option value="">Ignore</option>
                        {AR_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r, ri) => (
                  <tr key={ri} className="border-t border-gray-100">
                    {preview.headers.map((_, ci) => (
                      <td key={ci} className="px-2 py-1 text-gray-600">
                        {r[ci]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="max-w-xs">
            <label className="label">Annual credit sales in SAR (optional, for DSO)</label>
            <input className="input" value={sales} onChange={(e) => setSales(e.target.value)} placeholder="e.g. 4,500,000" />
          </div>
          <button className="btn" onClick={doImport} disabled={busy}>
            {busy ? <><span className="spinner" />Importing…</> : "Import data"}
          </button>
        </div>
      )}
      {msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}
