import { scoreBand } from "@/lib/scoring";

const COLORS = {
  red: "bg-red-50 text-red-800 border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  lime: "bg-lime-50 text-lime-800 border-lime-200",
  green: "bg-green-50 text-green-800 border-green-200",
  gray: "bg-gray-50 text-gray-600 border-gray-200",
};

export function ScoreBadge({ score }: { score: number | null }) {
  const b = scoreBand(score);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${COLORS[b.color]}`}>
      {score !== null && <span>{Number(score).toFixed(1)} / 5</span>}
      <span>{b.label}</span>
    </span>
  );
}

export function RagDot({ rag }: { rag: string | null }) {
  const c = rag === "green" ? "bg-green-600" : rag === "amber" ? "bg-amber-500" : rag === "red" ? "bg-red-600" : "bg-gray-300";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c}`} aria-label={rag ?? "no status"} />;
}
