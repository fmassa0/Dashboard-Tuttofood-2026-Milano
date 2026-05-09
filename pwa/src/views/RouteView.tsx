import { useMemo } from "react";
import { useAppState } from "../state";
import { HALL_BOXES } from "../data/halls";
import { optimizeRoute } from "../data/route";
import type { ViewName } from "../types";

interface Props {
  setView: (v: ViewName) => void;
}

const DEFAULT_START = "12";

export function RouteView({ setView }: Props) {
  const {
    exhibitors,
    visits,
    settings,
    toggleVisited,
    togglePlanned,
    setRouteStart,
  } = useAppState();

  const start = settings.routeStart ?? DEFAULT_START;

  const planned = useMemo(
    () => exhibitors.filter((e) => visits[e.id]?.planned),
    [exhibitors, visits],
  );

  const route = useMemo(() => optimizeRoute(planned, start), [planned, start]);

  const visitedCount = planned.reduce(
    (n, e) => n + (visits[e.id]?.visited ? 1 : 0),
    0,
  );

  const allHallIds = useMemo(
    () =>
      HALL_BOXES.map((h) => h.id).sort(
        (a, b) => Number(a) - Number(b) || a.localeCompare(b),
      ),
    [],
  );

  if (planned.length === 0) {
    return (
      <div className="px-4 pt-safe pb-2 max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">Percorso consigliato</h1>
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center space-y-3">
          <p className="text-2xl" aria-hidden="true">★</p>
          <p className="font-medium">Nessuno espositore selezionato</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Apri la lista, usa i filtri per trovare gli stand che ti
            interessano e tocca la stella su una card per aggiungerla al
            percorso. Quando hai finito, torna qui per vedere l'ordine
            ottimizzato.
          </p>
          <button
            type="button"
            onClick={() => setView("list")}
            className="min-h-tap px-4 rounded-full bg-brand-500 text-white font-medium"
          >
            Vai alla lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-safe pb-2 max-w-2xl mx-auto space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Percorso consigliato</h1>
        <span className="text-xs text-neutral-500">
          {visitedCount}/{planned.length} fatti · {route.stops.length}{" "}
          {route.stops.length === 1 ? "padiglione" : "padiglioni"}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="route-start" className="text-neutral-600 dark:text-neutral-400">
          Parto da
        </label>
        <select
          id="route-start"
          value={start}
          onChange={(e) => void setRouteStart(e.target.value)}
          className="min-h-tap rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2"
        >
          {allHallIds.map((h) => (
            <option key={h} value={h}>
              Pad. {h}
            </option>
          ))}
        </select>
        {route.unknownHalls.length > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {route.unknownHalls.length} pad. senza posizione mappata in coda
          </span>
        )}
      </div>

      <ol className="space-y-4">
        {route.stops.map((stop, idx) => {
          const stopVisited = stop.exhibitors.every((e) => visits[e.id]?.visited);
          return (
            <li
              key={stop.hall}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            >
              <div
                className={`px-4 py-2 flex items-center justify-between gap-2 ${
                  stopVisited
                    ? "bg-emerald-50 dark:bg-emerald-900/20"
                    : "bg-neutral-50 dark:bg-neutral-900"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold"
                  >
                    {idx + 1}
                  </span>
                  <span className="font-semibold">Pad. {stop.hall}</span>
                  <span className="text-xs text-neutral-500">
                    {stop.exhibitors.length}{" "}
                    {stop.exhibitors.length === 1 ? "stand" : "stand"}
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {stop.exhibitors.map((ex) => {
                  const v = visits[ex.id];
                  const isVisited = v?.visited ?? false;
                  return (
                    <li
                      key={ex.id}
                      className={`px-4 py-2 flex items-start gap-3 min-h-tap ${
                        isVisited ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void toggleVisited(ex.id)}
                        aria-pressed={isVisited}
                        aria-label={
                          isVisited ? "Segna come non visitato" : "Segna come visitato"
                        }
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          isVisited
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-neutral-300 dark:border-neutral-600"
                        }`}
                      >
                        {isVisited ? "✓" : ""}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`font-medium leading-tight truncate ${
                            isVisited ? "line-through text-neutral-500" : ""
                          }`}
                        >
                          {ex.nome}
                        </div>
                        <div className="text-xs text-neutral-500 truncate">
                          {ex.stand ? `Stand ${ex.stand}` : "Stand n.d."}
                          {ex.citta ? ` · ${ex.citta}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void togglePlanned(ex.id)}
                        aria-label="Rimuovi dal percorso"
                        title="Rimuovi dal percorso"
                        className="shrink-0 min-h-tap min-w-tap px-2 text-amber-500 text-lg"
                      >
                        <span aria-hidden="true">★</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-neutral-500 pt-2">
        L'ordine minimizza gli spostamenti fra padiglioni partendo dal Pad.{" "}
        {start}; gli stand dentro lo stesso padiglione sono ordinati per numero.
      </p>
    </div>
  );
}
