// Maturity scoring. Questionnaire answers are 0–4; scores are reported on a 1–5 scale.

export const MATURITY_LEVELS = [
  { value: 0, label: "Not in place" },
  { value: 1, label: "Informal / ad hoc" },
  { value: 2, label: "Documented" },
  { value: 3, label: "Implemented consistently" },
  { value: 4, label: "Monitored & improved" },
] as const;

export type ScoredQuestion = {
  id: string;
  dimension: string;
  weight: number;
  answer_type: string;
};

export type ResponseRow = { question_id: string; source: "consultant" | "client"; value: unknown };

/** Consultant answers win over client answers when both exist (consultant has verified). */
export function effectiveAnswers(responses: ResponseRow[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const r of responses) if (r.source === "client" && r.value !== null) map.set(r.question_id, r.value);
  for (const r of responses) if (r.source === "consultant" && r.value !== null) map.set(r.question_id, r.value);
  return map;
}

const toLevel = (v: number) => Math.round((1 + v) * 10) / 10; // 0–4 → 1–5

export function computeScores(questions: ScoredQuestion[], answers: Map<string, unknown>) {
  const dims = new Map<string, { sum: number; w: number }>();
  let answered = 0;
  let scorable = 0;
  for (const q of questions) {
    if (q.answer_type !== "maturity" || q.weight <= 0) continue;
    scorable++;
    const v = answers.get(q.id);
    if (typeof v !== "number") continue;
    answered++;
    const d = dims.get(q.dimension) ?? { sum: 0, w: 0 };
    d.sum += v * q.weight;
    d.w += q.weight;
    dims.set(q.dimension, d);
  }
  const dimension_scores: Record<string, number> = {};
  let total = 0;
  let totalW = 0;
  for (const [k, d] of dims) {
    dimension_scores[k] = toLevel(d.sum / d.w);
    total += d.sum;
    totalW += d.w;
  }
  return {
    score: totalW ? toLevel(total / totalW) : null,
    dimension_scores,
    answered,
    scorable,
  };
}

export function scoreBand(score: number | null) {
  if (score === null) return { label: "Not assessed", color: "gray" as const };
  if (score < 2) return { label: "Critical", color: "red" as const };
  if (score < 3) return { label: "Developing", color: "amber" as const };
  if (score < 4) return { label: "Established", color: "lime" as const };
  return { label: "Advanced", color: "green" as const };
}
