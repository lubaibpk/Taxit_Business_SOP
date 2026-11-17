"use client";
import Link from "next/link";
import { useState } from "react";

type Row = { id: string; name: string; name_ar: string | null; industry: string | null; city: string | null; erp: string | null; assessments: number; last: string | null };

export function ClientTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => [r.name, r.name_ar, r.industry, r.city, r.erp].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <input className="input max-w-sm" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs text-gray-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Client</th>
              <th className="px-5 py-2.5 font-medium">Industry</th>
              <th className="px-5 py-2.5 font-medium">City</th>
              <th className="px-5 py-2.5 font-medium">ERP</th>
              <th className="px-5 py-2.5 font-medium">Assessments</th>
              <th className="px-5 py-2.5 font-medium">Last assessed</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-5 py-3">
                  <Link href={`/clients/${c.id}`} className="font-medium text-brand hover:underline">
                    {c.name}
                  </Link>
                  {c.name_ar && (
                    <div className="text-xs text-gray-400" dir="rtl">
                      {c.name_ar}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-600">{c.industry}</td>
                <td className="px-5 py-3 text-gray-600">{c.city}</td>
                <td className="px-5 py-3 text-gray-600">{c.erp}</td>
                <td className="px-5 py-3 text-gray-600">{c.assessments}</td>
                <td className="px-5 py-3 text-gray-600">{c.last ?? "—"}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-gray-500">
                  No clients match &quot;{q}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
