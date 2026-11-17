// AR ageing import: header detection, column mapping suggestions and receivable metrics.

export const AR_FIELDS = [
  { key: "customer_code", label: "Customer code", numeric: false },
  { key: "customer_name", label: "Customer name", numeric: false, required: true },
  { key: "salesman", label: "Salesman / owner", numeric: false },
  { key: "credit_limit", label: "Credit limit", numeric: true },
  { key: "b0_30", label: "Current / 0–30 days", numeric: true },
  { key: "b31_60", label: "31–60 days", numeric: true },
  { key: "b61_90", label: "61–90 days", numeric: true },
  { key: "b90_plus", label: "Over 90 days (all older buckets)", numeric: true },
  { key: "total", label: "Total outstanding", numeric: true },
] as const;

export type ArFieldKey = (typeof AR_FIELDS)[number]["key"];
/** column index → field key (several columns may map to the same numeric field; they are summed) */
export type ColumnMap = Record<number, ArFieldKey | "">;

const RULES: [ArFieldKey, RegExp][] = [
  ["customer_code", /(cust(omer)?|party|account|acc)\.?\s*(code|no|id|#)|^code$|^id$/i],
  ["customer_name", /(customer|party|client|account)\s*name|^name$|^customer$|^party$|اسم/i],
  ["salesman", /sales\s*(man|person|rep|executive)|^rep$|agent/i],
  ["credit_limit", /credit\s*limit|limit/i],
  ["b90_plus", /(above|over|>|more than)\s*90|9[01]\s*[-–]\s*1[28]0|1[28]0\s*\+|>\s*1[28]0|over\s*1[28]0|9[01]\s*\+|91\+|180|365/i],
  ["b61_90", /6[01]\s*[-–to]+\s*90/i],
  ["b31_60", /3[01]\s*[-–to]+\s*60/i],
  ["b0_30", /^current$|not\s*due|0\s*[-–to]+\s*30|1\s*[-–to]+\s*30/i],
  ["total", /total|balance|outstanding|net\s*due|closing/i],
];

export function suggestField(header: string): ArFieldKey | "" {
  const h = header.trim();
  if (!h) return "";
  for (const [key, re] of RULES) if (re.test(h)) return key;
  return "";
}

/** Picks the row (within the first 20) that looks most like a header row. */
export function detectHeaderRow(rows: unknown[][]): number {
  let best = 0;
  let bestScore = -1;
  rows.slice(0, 20).forEach((row, i) => {
    // count distinct recognised fields; long sentences (instructions, merged title rows) don't count
    const fields = new Set(
      row.filter((c): c is string => typeof c === "string" && c.trim().length <= 40).map(suggestField).filter(Boolean),
    );
    const score = fields.size;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

export function suggestMap(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<string>();
  headers.forEach((h, i) => {
    const f = suggestField(h);
    // text fields map only once; numeric buckets can take several columns
    const textField = f && !AR_FIELDS.find((x) => x.key === f)?.numeric;
    if (f && textField && used.has(f)) return void (map[i] = "");
    if (f === "total" && used.has("total")) return void (map[i] = "");
    map[i] = f;
    if (f) used.add(f);
  });
  return map;
}

export type ArRow = {
  customer_code: string;
  customer_name: string;
  salesman: string;
  credit_limit: number | null;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90_plus: number;
  total: number;
};

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[,\s]|SAR|SR/gi, "").replace(/^\((.*)\)$/, "-$1"));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export function normaliseRows(rows: unknown[][], headerRow: number, map: ColumnMap): ArRow[] {
  const out: ArRow[] = [];
  const hasBuckets = Object.values(map).some((f) => f && f.startsWith("b"));
  for (const row of rows.slice(headerRow + 1)) {
    const r: ArRow = { customer_code: "", customer_name: "", salesman: "", credit_limit: null, b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 };
    let mappedTotal = 0;
    for (const [idx, field] of Object.entries(map)) {
      if (!field) continue;
      const v = row[Number(idx)];
      if (field === "customer_code" || field === "customer_name" || field === "salesman") {
        r[field] = String(v ?? "").trim();
      } else if (field === "credit_limit") {
        r.credit_limit = v === null || v === undefined || v === "" ? null : num(v);
      } else if (field === "total") {
        mappedTotal += num(v);
      } else {
        r[field] += num(v);
      }
    }
    if (!r.customer_name || /^(grand\s*)?total/i.test(r.customer_name)) continue;
    r.total = hasBuckets ? r.b0_30 + r.b31_60 + r.b61_90 + r.b90_plus : mappedTotal;
    if (!hasBuckets) r.b0_30 = mappedTotal;
    if (r.total === 0) continue;
    out.push(r);
  }
  return out;
}

export type Metric = {
  code: string;
  label: string;
  value: number | null;
  unit: string;
  rag: "green" | "amber" | "red" | null;
  detail?: unknown;
};

const rag = (v: number, green: number, amber: number): Metric["rag"] => (v <= green ? "green" : v <= amber ? "amber" : "red");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export function computeArMetrics(rows: ArRow[], annualCreditSales?: number | null): Metric[] {
  const pos = rows.filter((r) => r.total > 0);
  const total = pos.reduce((s, r) => s + r.total, 0);
  const sum = (k: "b0_30" | "b31_60" | "b61_90" | "b90_plus") => pos.reduce((s, r) => s + Math.max(r[k], 0), 0);
  const b = { b0_30: sum("b0_30"), b31_60: sum("b31_60"), b61_90: sum("b61_90"), b90_plus: sum("b90_plus") };
  const over30 = b.b31_60 + b.b61_90 + b.b90_plus;
  const top = [...pos].sort((a, c) => c.total - a.total).slice(0, 10);
  const top10 = top.reduce((s, r) => s + r.total, 0);
  const credits = rows.filter((r) => r.total < 0);
  const overLimit = pos.filter((r) => r.credit_limit && r.credit_limit > 0 && r.total > r.credit_limit);

  const metrics: Metric[] = [
    {
      code: "total_ar",
      label: "Total receivables outstanding",
      value: Math.round(total),
      unit: "SAR",
      rag: null,
      detail: {
        buckets: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, { amount: Math.round(v), pct: pct(v, total) }])),
      },
    },
    { code: "customers_with_balance", label: "Customers with a balance", value: pos.length, unit: "count", rag: null },
    { code: "pct_over_30", label: "Receivables older than 30 days", value: pct(over30, total), unit: "%", rag: rag(pct(over30, total), 15, 25) },
    { code: "pct_over_60", label: "Receivables older than 60 days", value: pct(b.b61_90 + b.b90_plus, total), unit: "%", rag: rag(pct(b.b61_90 + b.b90_plus, total), 8, 15) },
    { code: "pct_over_90", label: "Receivables older than 90 days", value: pct(b.b90_plus, total), unit: "%", rag: rag(pct(b.b90_plus, total), 5, 10) },
    {
      code: "customers_over_90",
      label: "Customers with balances over 90 days",
      value: pos.filter((r) => r.b90_plus > 0).length,
      unit: "count",
      rag: rag(pos.filter((r) => r.b90_plus > 0).length, 0, 5),
    },
    {
      code: "top10_concentration",
      label: "Share of receivables held by top 10 customers",
      value: pct(top10, total),
      unit: "%",
      rag: rag(pct(top10, total), 40, 60),
      detail: {
        top_customers: top.map((r) => ({ name: r.customer_name, total: Math.round(r.total), over_90: Math.round(r.b90_plus), pct: pct(r.total, total) })),
      },
    },
  ];
  if (rows.some((r) => r.credit_limit !== null)) {
    metrics.push({
      code: "over_limit",
      label: "Customers above their credit limit",
      value: overLimit.length,
      unit: "count",
      rag: rag(overLimit.length, 0, 3),
    });
  }
  if (credits.length) {
    metrics.push({
      code: "credit_balances",
      label: "Customers with credit (negative) balances — check unapplied receipts",
      value: credits.length,
      unit: "count",
      rag: credits.length > 5 ? "amber" : "green",
      detail: { amount: Math.round(credits.reduce((s, r) => s + r.total, 0)) },
    });
  }
  if (annualCreditSales && annualCreditSales > 0) {
    const dso = Math.round((total / annualCreditSales) * 365);
    metrics.push({ code: "dso", label: "Days sales outstanding (DSO)", value: dso, unit: "days", rag: rag(dso, 40, 55) });
  }
  return metrics;
}
