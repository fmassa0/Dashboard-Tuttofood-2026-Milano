import { useMemo } from "react";
import { useAppState } from "../state";
import type { ViewName } from "../types";

interface Props {
  setView: (v: ViewName) => void;
  setPadiglioneFilter: (p: string) => void;
}

// Bounding box of each hall on the cropped plan image (hall-plan-padiglioni.png),
// expressed as percentages so the overlay scales with the image at any size.
// Coordinates were measured visually from the official Tuttofood 2026 plan.
interface HallBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const HALL_BOXES: HallBox[] = [
  { id: "12", left: 22.5, top: 18.5, width: 16.5, height: 19.5 },
  { id: "8",  left: 39.0, top: 18.5, width: 18.5, height: 19.5 },
  { id: "4",  left: 60.0, top: 19.0, width: 11.5, height: 14.5 },
  { id: "2",  left: 71.5, top: 19.0, width: 17.5, height: 26.0 },
  { id: "10", left: 22.5, top: 32.5, width: 26.0, height: 17.0 },
  { id: "6",  left: 48.5, top: 32.5, width: 11.5, height: 17.0 },
  { id: "7",  left: 35.0, top: 60.0, width: 13.5, height: 25.0 },
  { id: "5",  left: 48.5, top: 60.0, width: 14.0, height: 25.0 },
  { id: "3",  left: 67.5, top: 60.0, width: 9.5,  height: 25.0 },
  { id: "1",  left: 77.0, top: 60.0, width: 12.0, height: 25.0 },
];

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
    return map;
  }, [exhibitors, visits]);

  const ordered = useMemo(
    () =>
      Object.entries(stats).sort(
        ([a], [b]) => Number(a) - Number(b) || a.localeCompare(b),
      ),
    [stats],
  );

  const totalVisited = ordered.reduce((s, [, x]) => s + x.visited, 0);
  const total = ordered.reduce((s, [, x]) => s + x.total, 0);

  const goToHall = (pad: string) => {
    setPadiglioneFilter(pad);
    setView("list");
  };

  // emerald 500 with alpha based on visit ratio
  const heatColor = (ratio: number) =>
    `rgba(16,185,129,${Math.min(0.78, 0.18 + ratio * 0.7)})`;

  return (
    <div className="px-4 pt-safe pb-2 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">Mappa padiglioni</h1>
        <span className="text-xs text-neutral-500">
          {totalVisited}/{total} visitati
        </span>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Tap su un padiglione per filtrare la lista. Le aree colorate riflettono la copertura delle visite.
      </p>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr] items-start">
        {/* Mappa con hotspot */}
        <figure className="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white">
          <div className="relative w-full">
            <img
              src={`${base}/hall-plan-padiglioni.png`}
              alt="Planimetria padiglioni Tuttofood 2026"
              className="block w-full h-auto select-none"
              draggable={false}
              loading="eager"
            />
            {HALL_BOXES.map((b) => {
              const s = stats[b.id] ?? { total: 0, visited: 0 };
              const ratio = s.total ? s.visited / s.total : 0;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => goToHall(b.id)}
                  aria-label={`Padiglione ${b.id}: ${s.visited} visitati su ${s.total}, filtra lista`}
                  className="absolute group rounded-md ring-2 ring-transparent hover:ring-brand-500 focus-visible:ring-brand-500 transition-shadow"
                  style={{
                    left: `${b.left}%`,
                    top: `${b.top}%`,
                    width: `${b.width}%`,
                    height: `${b.height}%`,
                    backgroundColor: ratio > 0 ? heatColor(ratio) : "rgba(0,0,0,0.001)",
                  }}
                >
                  <span className="sr-only">Padiglione {b.id}</span>
                  {ratio > 0 && (
                    <span
                      className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white drop-shadow"
                      aria-hidden="true"
                    >
                      {s.visited}/{s.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <figcaption className="px-3 py-2 text-xs text-neutral-500">
            Fonte: tuttofood.it
          </figcaption>
        </figure>

        {/* Tile heatmap (desktop a fianco, mobile sotto) */}
        <section aria-label="Heatmap padiglioni">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Heatmap visite
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-1 gap-2">
            {ordered.map(([pad, x]) => {
              const ratio = x.total ? x.visited / x.total : 0;
              return (
                <li key={pad}>
                  <button
                    type="button"
                    onClick={() => goToHall(pad)}
                    className="w-full rounded-lg p-3 text-left border border-neutral-200 dark:border-neutral-800 min-h-tap hover:ring-2 hover:ring-brand-500 transition-all"
                    style={{ backgroundColor: ratio > 0 ? heatColor(ratio) : undefined }}
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
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
