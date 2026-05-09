import { useRef, useState } from "react";
import { useAppState } from "../state";
import type { Exhibitor } from "../types";

interface Props {
  exhibitors: Exhibitor[];
  onExit: () => void;
}

interface Stats {
  planned: number;
  skipped: number;
  deferred: number;
}

const SWIPE_THRESHOLD_X = 0.22; // 22% larghezza viewport
const SWIPE_THRESHOLD_Y = 0.18; // 18% altezza viewport

const INITIAL_STATS: Stats = { planned: 0, skipped: 0, deferred: 0 };

/**
 * Modalità "triage rapido" tipo carte: una scheda per volta a tutto schermo.
 *  - swipe a destra (o bottone "Pianifica")  → aggiunge ai preferiti del percorso
 *  - swipe a sinistra (o bottone "Scarta")    → avanza senza modificare nulla
 *  - swipe in giù (o bottone "Dopo")          → avanza, decisione rimandata
 *
 * Pensato per il pre-fiera: 1500 espositori filtrati al volo.
 */
export function FastTriage({ exhibitors, onExit }: Props) {
  const { visits, updateVisit } = useAppState();
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const total = exhibitors.length;
  const current = exhibitors[index];

  const advance = () => {
    setIndex((i) => i + 1);
    setDrag({ x: 0, y: 0 });
  };

  const onPlan = async () => {
    if (current && !visits[current.id]?.planned) {
      await updateVisit(current.id, { planned: true });
    }
    setStats((s) => ({ ...s, planned: s.planned + 1 }));
    advance();
  };

  const onSkip = () => {
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    advance();
  };

  const onDefer = () => {
    setStats((s) => ({ ...s, deferred: s.deferred + 1 }));
    advance();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startRef.current) return;
    const dx = e.touches[0].clientX - startRef.current.x;
    const dy = e.touches[0].clientY - startRef.current.y;
    setDrag({ x: dx, y: dy });
  };

  const handleTouchEnd = () => {
    if (!startRef.current) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (drag.x > w * SWIPE_THRESHOLD_X) {
      void onPlan();
    } else if (drag.x < -w * SWIPE_THRESHOLD_X) {
      onSkip();
    } else if (drag.y > h * SWIPE_THRESHOLD_Y && Math.abs(drag.x) < w * 0.15) {
      onDefer();
    } else {
      // sotto soglia → torno al centro
      setDrag({ x: 0, y: 0 });
    }
    startRef.current = null;
    dragging.current = false;
  };

  const handleTouchCancel = () => {
    setDrag({ x: 0, y: 0 });
    startRef.current = null;
    dragging.current = false;
  };

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-lg">Nessun espositore nei filtri attivi.</p>
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

  if (index >= total) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-neutral-950 flex flex-col">
        <div className="px-4 pt-safe py-3 flex items-center justify-end border-b border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={onExit}
            className="min-h-tap min-w-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium"
          >
            Chiudi
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="text-6xl" aria-hidden="true">🏁</div>
          <h2 className="text-2xl font-bold">Triage finito</h2>
          <ul className="text-sm text-neutral-700 dark:text-neutral-300 space-y-1">
            <li>
              ★ Pianificati: <strong>{stats.planned}</strong>
            </li>
            <li>
              ↓ Da rivedere dopo: <strong>{stats.deferred}</strong>
            </li>
            <li>
              ✕ Scartati: <strong>{stats.skipped}</strong>
            </li>
            <li className="pt-1 text-xs text-neutral-500">
              Totale visti: {total}
            </li>
          </ul>
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setStats(INITIAL_STATS);
              setDrag({ x: 0, y: 0 });
            }}
            className="mt-4 min-h-tap px-6 rounded-full border border-neutral-300 dark:border-neutral-700 font-medium"
          >
            Riparti dall'inizio
          </button>
        </div>
      </div>
    );
  }

  const visit = visits[current.id];
  const alreadyPlanned = visit?.planned ?? false;
  const alreadyVisited = visit?.visited ?? false;

  const showPlanHint = drag.x > 60;
  const showSkipHint = drag.x < -60;
  const showDeferHint = drag.y > 60 && Math.abs(drag.x) < 60;

  const cats = (current.categorie || "")
    .split(" | ")
    .filter(Boolean)
    .slice(0, 6);

  const progress = Math.round((index / total) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-100 dark:bg-neutral-900 flex flex-col select-none touch-pan-y overscroll-none">
      {/* Header */}
      <div className="px-4 pt-safe py-2 flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <button
          type="button"
          onClick={onExit}
          className="min-h-tap min-w-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium"
        >
          Esci
        </button>
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="text-xs text-neutral-500 text-center">
            Triage {index + 1} / {total} · ★ {stats.planned} · ↓ {stats.deferred}
          </div>
          <div className="h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 relative overflow-hidden">
        <div
          className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl shadow-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-5 touch-none"
          style={{
            transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 30}deg)`,
            transition: dragging.current ? "none" : "transform 0.18s ease-out",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <div className="flex flex-wrap gap-1 mb-2">
            {alreadyPlanned && (
              <span className="text-[10px] uppercase tracking-wide rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5">
                ★ Già nel percorso
              </span>
            )}
            {alreadyVisited && (
              <span className="text-[10px] uppercase tracking-wide rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 px-2 py-0.5">
                ✓ Visitato
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold leading-tight">{current.nome}</h2>

          {(current.padiglione || current.stand) && (
            <div className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              {current.padiglione ? `Pad. ${current.padiglione}` : ""}
              {current.stand ? ` · Stand ${current.stand}` : ""}
            </div>
          )}

          <div className="mt-1 text-sm text-neutral-500">
            {[
              current.citta,
              current.provincia ? `(${current.provincia})` : "",
              current.regione,
              current.paese,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>

          {current.marchi && (
            <div className="mt-3 text-sm">
              <span className="text-neutral-500">Marchi: </span>
              <span className="text-neutral-800 dark:text-neutral-100">{current.marchi}</span>
            </div>
          )}

          {cats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {cats.map((c) => (
                <span
                  key={c}
                  className="text-xs rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {current.descrizione && (
            <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              {current.descrizione}
            </p>
          )}

          {current.sito_web && (
            <div className="mt-4 text-xs">
              <a
                href={current.sito_web}
                target="_blank"
                rel="noreferrer"
                className="text-brand-500 underline break-all"
              >
                {current.sito_web}
              </a>
            </div>
          )}
        </div>

        {/* Hint overlay */}
        {showPlanHint && (
          <div className="absolute top-1/4 right-6 rotate-[-12deg] text-2xl font-black text-amber-500 border-4 border-amber-500 rounded-lg px-3 py-1 pointer-events-none bg-white/80 dark:bg-neutral-950/80">
            ★ PIANIFICA
          </div>
        )}
        {showSkipHint && (
          <div className="absolute top-1/4 left-6 rotate-[12deg] text-2xl font-black text-neutral-400 border-4 border-neutral-400 rounded-lg px-3 py-1 pointer-events-none bg-white/80 dark:bg-neutral-950/80">
            ✕ SCARTA
          </div>
        )}
        {showDeferHint && (
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 text-2xl font-black text-sky-500 border-4 border-sky-500 rounded-lg px-3 py-1 pointer-events-none bg-white/80 dark:bg-neutral-950/80">
            ↓ DOPO
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="px-3 pb-safe pt-2 flex gap-2 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 min-h-tap rounded-lg border-2 border-neutral-300 dark:border-neutral-700 font-bold text-sm"
        >
          ✕ Scarta
        </button>
        <button
          type="button"
          onClick={onDefer}
          className="flex-1 min-h-tap rounded-lg border-2 border-sky-500 text-sky-600 dark:text-sky-400 font-bold text-sm"
        >
          ↓ Dopo
        </button>
        <button
          type="button"
          onClick={() => void onPlan()}
          className="flex-[1.4] min-h-tap rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm"
        >
          ★ Pianifica
        </button>
      </div>
    </div>
  );
}
