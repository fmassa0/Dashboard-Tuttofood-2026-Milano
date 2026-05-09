import { useMemo } from "react";
import { useAppState } from "../state";
import type { ViewName } from "../types";

interface Props {
  setView: (v: ViewName) => void;
  setPadiglioneFilter: (p: string) => void;
}

export function MapView({ setView, setPadiglioneFilter }: Props) {
  const { exhibitors, visits } = useAppState();
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

  const stats = useMemo(() => {
    const map: Record<string, { total: number; visited: number }> = {};
    for (const e of exhibitors) {
      const p = e.padiglione || "?";
      map[p] ??= { total: 0, visited: 0 };
      map[p].total += 1;
      if (visits[e.id]?.visited) map[p].visited += 1;
    }
    return Object.entries(map).sort(
      ([a], [b]) => Number(a) - Number(b) || a.localeCompare(b),
    );
  }, [exhibitors, visits]);

  const totalVisited = stats.reduce((s, [, x]) => s + x.visited, 0);
  const total = stats.reduce((s, [, x]) => s + x.total, 0);

  return (
    <div className="px-4 pt-safe pb-2 space-y-4">
      <h1 className="text-xl font-bold">Mappa padiglioni</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Riferimento: planimetria ufficiale Tuttofood 2026. Tap su un padiglione per filtrare la lista.
      </p>

      <figure className="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white">
        <img
          src={`${base}/hall-plan.png`}
          alt="Planimetria Tuttofood 2026"
          className="w-full h-auto"
          loading="eager"
        />
        <figcaption className="px-3 py-2 text-xs text-neutral-500">
          Fonte: tuttofood.it
        </figcaption>
      </figure>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold">Heatmap visite</h2>
          <span className="text-xs text-neutral-500">
            {totalVisited}/{total} visitati
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stats.map(([pad, x]) => {
            const ratio = x.total ? x.visited / x.total : 0;
            // gradient from neutral to emerald
            const bg = `rgba(16,185,129,${Math.min(0.85, 0.15 + ratio * 0.85)})`;
            return (
              <button
                key={pad}
                type="button"
                onClick={() => {
                  setPadiglioneFilter(pad);
                  setView("list");
                }}
                className="rounded-lg p-3 text-left border border-neutral-200 dark:border-neutral-800 min-h-tap hover:ring-2 hover:ring-brand-500 transition-all"
                style={{ backgroundColor: ratio > 0 ? bg : undefined }}
                aria-label={`Padiglione ${pad}: ${x.visited} visitati su ${x.total}, filtra lista`}
              >
                <div className="font-semibold">
                  Pad. <span className="text-lg">{pad}</span>
                </div>
                <div className="text-xs text-neutral-700 dark:text-neutral-200">
                  {x.visited} / {x.total}
                  <span className="ml-1 opacity-70">
                    ({Math.round(ratio * 100)}%)
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
