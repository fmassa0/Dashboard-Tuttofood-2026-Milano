import { useMemo } from "react";
import { useAppState } from "../state";

export function DashboardView() {
  const { exhibitors, visits } = useAppState();

  const stats = useMemo(() => {
    const visited = exhibitors.filter((e) => visits[e.id]?.visited);
    const remaining = exhibitors.length - visited.length;

    // Tempo medio fra visite consecutive (sequenza ordinata per timestamp)
    const ts = visited
      .map((e) => visits[e.id]?.visitedAt ?? 0)
      .filter((t) => t > 0)
      .sort((a, b) => a - b);
    let avgGap = 0;
    if (ts.length >= 2) {
      let sum = 0;
      for (let i = 1; i < ts.length; i++) {
        const gap = ts[i] - ts[i - 1];
        // ignora pause > 2 ore (non sono "tempo per espositore")
        if (gap < 2 * 60 * 60 * 1000) sum += gap;
      }
      avgGap = sum / (ts.length - 1);
    }

    const tagCounter = new Map<string, number>();
    for (const e of exhibitors) {
      for (const t of visits[e.id]?.tags ?? []) {
        tagCounter.set(t, (tagCounter.get(t) ?? 0) + 1);
      }
    }
    const topTags = Array.from(tagCounter.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const toReview = exhibitors
      .filter((e) => visits[e.id]?.tags?.includes("ricontattare"))
      .map((e) => ({ ex: e, v: visits[e.id]! }));

    const recents = visited
      .slice()
      .sort((a, b) => (visits[b.id]?.visitedAt ?? 0) - (visits[a.id]?.visitedAt ?? 0))
      .slice(0, 10);

    return { visited, remaining, avgGap, topTags, toReview, recents };
  }, [exhibitors, visits]);

  const fmtMin = (ms: number) => {
    if (!ms) return "—";
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`;
  };
  const fmtDate = (t?: number) =>
    t ? new Date(t).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "—";

  const pct = exhibitors.length ? (stats.visited.length / exhibitors.length) * 100 : 0;

  return (
    <div className="px-4 pt-safe pb-2 space-y-5">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <Stat title="Visitati" value={String(stats.visited.length)} sub={`su ${exhibitors.length}`} accent="emerald" />
        <Stat title="Rimanenti" value={String(stats.remaining)} sub={`${(100 - pct).toFixed(0)}%`} />
        <Stat title="Tempo medio" value={fmtMin(stats.avgGap)} sub="fra visite consecutive" />
        <Stat title="Avanzamento" value={`${pct.toFixed(0)}%`} sub="della fiera" accent="brand" />
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
        <div className="text-xs uppercase text-neutral-500 mb-1">Avanzamento</div>
        <div className="h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${pct}%` }}
            aria-label={`${pct.toFixed(0)}% visitati`}
          />
        </div>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Tag più usati</h2>
        {stats.topTags.length === 0 ? (
          <p className="text-sm text-neutral-500">Nessun tag ancora.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {stats.topTags.map(([t, n]) => (
              <li key={t} className="text-xs rounded-full px-2 py-1 bg-neutral-100 dark:bg-neutral-800">
                {t} <span className="opacity-60">×{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Da rivedere ({stats.toReview.length})</h2>
        {stats.toReview.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nessun espositore taggato come <span className="font-mono">ricontattare</span>.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800">
            {stats.toReview.map(({ ex, v }) => (
              <li key={ex.id} className="px-3 py-2">
                <div className="font-medium">{ex.nome}</div>
                <div className="text-xs text-neutral-500">
                  {[ex.citta, ex.padiglione ? `Pad. ${ex.padiglione}` : ""].filter(Boolean).join(" · ")} · {fmtDate(v.visitedAt)}
                </div>
                {v.notes && <div className="mt-1 text-xs whitespace-pre-wrap">{v.notes}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Ultime visite</h2>
        {stats.recents.length === 0 ? (
          <p className="text-sm text-neutral-500">Nessuna visita registrata.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-800">
            {stats.recents.map((e) => (
              <li key={e.id} className="px-3 py-2 flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block font-medium truncate">{e.nome}</span>
                  <span className="block text-xs text-neutral-500 truncate">
                    {[e.citta, e.padiglione ? `Pad. ${e.padiglione}` : ""].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="text-xs text-neutral-500 shrink-0">{fmtDate(visits[e.id]?.visitedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "brand";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "brand"
        ? "text-brand-500"
        : "";
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs uppercase text-neutral-500">{title}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}
