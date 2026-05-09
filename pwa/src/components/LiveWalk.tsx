import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../state";
import type { OptimizedRoute } from "../data/route";

interface Props {
  route: OptimizedRoute;
  onExit: () => void;
}

interface Step {
  id: string;
  hall: string;
  stand: string;
  nome: string;
  citta: string;
  hallIndex: number;
  totalHalls: number;
  indexInHall: number;
  hallTotal: number;
}

/**
 * Modalità "guida live" del percorso. Schermata a tutto schermo, ottimizzata
 * per essere usata camminando con una mano: mostra una sola tappa per volta,
 * con bottone primario gigante "Fatto, prossimo" e azioni secondarie più
 * piccole. Si esce con il bottone in alto.
 */
export function LiveWalk({ route, onExit }: Props) {
  const { visits, updateVisit } = useAppState();

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [];
    route.stops.forEach((stop, hallIndex) => {
      stop.exhibitors.forEach((ex, indexInHall) => {
        out.push({
          id: ex.id,
          hall: stop.hall,
          stand: ex.stand,
          nome: ex.nome,
          citta: ex.citta,
          hallIndex,
          totalHalls: route.stops.length,
          indexInHall,
          hallTotal: stop.exhibitors.length,
        });
      });
    });
    return out;
  }, [route.stops]);

  // Riprendi dal primo non-visitato. Se sono tutti visitati, parto dall'inizio
  // così l'utente può comunque ripercorrere e ripassare.
  const [index, setIndex] = useState(() => {
    const firstUnvisited = steps.findIndex((s) => !visits[s.id]?.visited);
    return firstUnvisited >= 0 ? firstUnvisited : 0;
  });

  // Se i preferiti cambiano (rimosso uno stand mentre live), tieni l'indice
  // entro i bound.
  useEffect(() => {
    if (index >= steps.length && steps.length > 0) {
      setIndex(steps.length - 1);
    }
  }, [steps.length, index]);

  const visitedCount = steps.reduce(
    (n, s) => n + (visits[s.id]?.visited ? 1 : 0),
    0,
  );

  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg">Nessuno stand nel percorso filtrato.</p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 min-h-tap px-6 rounded-full bg-brand-500 text-white font-medium"
        >
          Chiudi
        </button>
      </div>
    );
  }

  const allDone = visitedCount >= steps.length;
  const current = steps[Math.min(index, steps.length - 1)];
  const next = steps[index + 1];
  const currentVisited = visits[current.id]?.visited ?? false;

  const advance = () => setIndex((i) => Math.min(i + 1, steps.length));
  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  const markDone = async () => {
    if (!currentVisited) {
      await updateVisit(current.id, { visited: true, visitedAt: Date.now() });
    }
    advance();
  };

  // Schermata di completamento: tutti visitati e l'utente ha proseguito oltre
  // l'ultimo elemento (oppure è arrivato sull'ultimo già visitato e tap "Fatto").
  if (allDone || index >= steps.length) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col">
        <div className="px-4 py-3 flex items-center justify-end border-b border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={onExit}
            className="min-h-tap min-w-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium"
          >
            Chiudi
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="text-6xl" aria-hidden="true">🎉</div>
          <h2 className="text-2xl font-bold">Percorso completato</h2>
          <p className="text-neutral-600 dark:text-neutral-400">
            {visitedCount} di {steps.length} stand visitati su {route.stops.length}{" "}
            {route.stops.length === 1 ? "padiglione" : "padiglioni"}.
          </p>
          <button
            type="button"
            onClick={() => setIndex(0)}
            className="mt-4 min-h-tap px-6 rounded-full border border-neutral-300 dark:border-neutral-700 font-medium"
          >
            Riparti dall'inizio
          </button>
        </div>
      </div>
    );
  }

  const progress = Math.round((visitedCount / steps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-safe py-2 flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-xs text-neutral-500">
          Tappa {index + 1} / {steps.length}
        </div>
        <div className="flex-1 mx-3 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onExit}
          className="min-h-tap min-w-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium"
          aria-label="Esci dalla modalità live"
        >
          Esci
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 text-center min-h-0 overflow-y-auto">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Vai a
        </div>
        <div className="mt-1 text-6xl font-black text-brand-500 leading-none">
          Pad. {current.hall}
        </div>
        {current.stand && (
          <div className="mt-3 text-3xl font-bold text-neutral-800 dark:text-neutral-100">
            Stand {current.stand}
          </div>
        )}
        <div className="mt-6 max-w-md">
          <div className="text-2xl font-bold leading-tight">{current.nome}</div>
          {current.citta && (
            <div className="mt-1 text-sm text-neutral-500">{current.citta}</div>
          )}
        </div>
        <div className="mt-4 text-xs text-neutral-500">
          stand {current.indexInHall + 1} di {current.hallTotal} nel padiglione
          · padiglione {current.hallIndex + 1} di {current.totalHalls}
        </div>

        {currentVisited && (
          <div className="mt-4 text-xs px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
            Già visitato
          </div>
        )}

        {next && (
          <div className="mt-8 text-xs text-neutral-500">
            <span className="opacity-60">Prossima:</span>{" "}
            <span className="font-medium">
              Pad. {next.hall}
              {next.stand ? ` · ${next.stand}` : ""}
            </span>
            <span className="opacity-60"> — {next.nome}</span>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-4 pb-safe pt-3 space-y-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => void markDone()}
          className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xl font-bold py-4 shadow-sm"
        >
          {currentVisited ? "Prossimo →" : "✓ Fatto, prossimo"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={index === 0}
            className="flex-1 min-h-tap rounded-lg border border-neutral-300 dark:border-neutral-700 font-medium disabled:opacity-40"
          >
            ← Indietro
          </button>
          <button
            type="button"
            onClick={advance}
            className="flex-1 min-h-tap rounded-lg border border-neutral-300 dark:border-neutral-700 font-medium"
          >
            Salta
          </button>
        </div>
      </div>
    </div>
  );
}
