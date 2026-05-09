import { useState } from "react";
import { useAppState } from "../state";
import type { Exhibitor } from "../types";

interface Props {
  exhibitors: Exhibitor[];
  onClose: () => void;
}

/**
 * Bottom sheet con le azioni applicabili in massa al sottoinsieme di
 * espositori filtrati nella lista. Ogni azione passa per una conferma testuale
 * (numero di record interessati) prima di scrivere su IndexedDB.
 */
export function BulkActionsSheet({ exhibitors, onClose }: Props) {
  const { updateVisitsMany, addCustomTag, customTags, visits } = useAppState();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  const ids = exhibitors.map((e) => e.id);
  const total = ids.length;

  const plannedCount = exhibitors.reduce(
    (n, e) => n + (visits[e.id]?.planned ? 1 : 0),
    0,
  );
  const visitedCount = exhibitors.reduce(
    (n, e) => n + (visits[e.id]?.visited ? 1 : 0),
    0,
  );

  const run = async (
    label: string,
    xform: (v: import("../types").VisitState) => import("../types").VisitState,
  ) => {
    if (!window.confirm(`${label} su ${total} espositori filtrati?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await updateVisitsMany(ids, xform);
      setMsg(`${label}: ${total} aggiornati ✓`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const planAll = () =>
    run("Aggiungi al percorso", (v) => ({ ...v, planned: true }));
  const unplanAll = () =>
    run("Rimuovi dal percorso", (v) => ({ ...v, planned: false }));
  const visitAll = () =>
    run("Marca visitati", (v) => ({
      ...v,
      visited: true,
      visitedAt: v.visitedAt ?? Date.now(),
    }));
  const unvisitAll = () =>
    run("Annulla visita", (v) => ({ ...v, visited: false }));

  const applyTag = async () => {
    const t = tagDraft.trim();
    if (!t) return;
    if (!window.confirm(`Aggiungi il tag "${t}" a ${total} espositori?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      await addCustomTag(t);
      await updateVisitsMany(ids, (v) => {
        const tags = new Set(v.tags ?? []);
        tags.add(t);
        return { ...v, tags: Array.from(tags) };
      });
      setMsg(`Tag "${t}" aggiunto a ${total} espositori ✓`);
      setShowTagPicker(false);
      setTagDraft("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-title"
    >
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 id="bulk-title" className="text-lg font-bold">
            Azioni in massa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap min-w-tap px-2 text-sm text-neutral-500"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          Stai per agire su <strong>{total} espositori</strong> filtrati
          {total > 0 && (
            <>
              {" "}— già nel percorso: <strong>{plannedCount}</strong>, visitati:{" "}
              <strong>{visitedCount}</strong>
            </>
          )}
          .
        </p>

        <div className="space-y-2">
          <BulkButton
            disabled={busy || total === 0}
            onClick={() => void planAll()}
            colorClass="bg-amber-500 hover:bg-amber-600 text-white"
            icon="★"
            label="Aggiungi tutti al percorso"
          />
          <BulkButton
            disabled={busy || total === 0 || plannedCount === 0}
            onClick={() => void unplanAll()}
            colorClass="border-2 border-amber-500 text-amber-600 dark:text-amber-400"
            icon="✕"
            label="Rimuovi tutti dal percorso"
          />
          <BulkButton
            disabled={busy || total === 0}
            onClick={() => void visitAll()}
            colorClass="bg-emerald-500 hover:bg-emerald-600 text-white"
            icon="✓"
            label="Marca tutti come visitati"
          />
          <BulkButton
            disabled={busy || total === 0 || visitedCount === 0}
            onClick={() => void unvisitAll()}
            colorClass="border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400"
            icon="↺"
            label="Annulla 'visitato' a tutti"
          />

          {!showTagPicker ? (
            <BulkButton
              disabled={busy || total === 0}
              onClick={() => setShowTagPicker(true)}
              colorClass="border-2 border-neutral-300 dark:border-neutral-700"
              icon="🏷"
              label="Aggiungi un tag a tutti..."
            />
          ) : (
            <div className="rounded-lg border-2 border-neutral-300 dark:border-neutral-700 p-2 space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {customTags.length > 0 ? (
                  customTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTagDraft(t)}
                      className={`min-h-tap px-3 rounded-full border text-xs font-medium ${
                        tagDraft === t
                          ? "bg-brand-500 border-brand-500 text-white"
                          : "border-neutral-300 dark:border-neutral-700"
                      }`}
                    >
                      {t}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-neutral-500">
                    Nessun tag custom: scrivine uno nuovo qui sotto.
                  </span>
                )}
              </div>
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="es. competitor, fornitore, ricontattare..."
                className="w-full min-h-tap rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTagPicker(false);
                    setTagDraft("");
                  }}
                  className="flex-1 min-h-tap rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm font-medium"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={busy || !tagDraft.trim()}
                  onClick={() => void applyTag()}
                  className="flex-1 min-h-tap rounded-lg bg-brand-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  Applica
                </button>
              </div>
            </div>
          )}
        </div>

        {msg && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 text-sm rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 px-2 py-1"
          >
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

function BulkButton({
  disabled,
  onClick,
  colorClass,
  icon,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  colorClass: string;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-lg py-3 px-4 font-medium text-sm flex items-center gap-2 disabled:opacity-50 ${colorClass}`}
    >
      <span aria-hidden="true" className="text-base">
        {icon}
      </span>
      {label}
    </button>
  );
}
