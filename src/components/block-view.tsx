import type { Block } from "@/lib/blocks";

export function BlockView({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 3 ? (
              <h4 key={i} className="pt-1 font-semibold text-[#1F3864]">
                {b.text}
              </h4>
            ) : (
              <h3 key={i} className="pt-2 text-base font-semibold text-[#1F3864]">
                {b.text}
              </h3>
            );
          case "paragraph":
            return <p key={i}>{b.text}</p>;
          case "bullets":
            return (
              <ul key={i} className="list-disc space-y-1 ps-5">
                {b.items.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            );
          case "numbered":
            return (
              <ol key={i} className="list-decimal space-y-1 ps-5">
                {b.items.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ol>
            );
          case "callout":
            return (
              <div key={i} className={`rounded-md border-s-4 p-3 ${b.tone === "info" ? "border-[#1F3864] bg-blue-50" : "border-red-700 bg-red-50"}`}>
                <div className="mb-1 text-xs font-bold uppercase tracking-wide">{b.title}</div>
                <ul className="list-disc space-y-1 ps-5">
                  {b.items.map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              </div>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  {b.headers.length > 0 && (
                    <thead>
                      <tr>
                        {b.headers.map((h, j) => (
                          <th key={j} className="border border-gray-300 bg-[#1F3864] px-2 py-1.5 text-start font-semibold text-white">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} className="border border-gray-200 px-2 py-1.5 align-top">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
