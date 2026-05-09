import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Exhibitor, VisitState, CompanySize } from "../types";
import { useAppState } from "../state";
import { inferSize, SIZE_LABEL } from "../data/heuristics";
import { MediaSection } from "./MediaSection";

interface Props {
  ex: Exhibitor;
  visit: VisitState | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
  /** invoked when the rendered card height changes (so a virtualized list can resize the slot) */
  onMeasure?: (id: string, height: number) => void;
}

const PRESET_TAGS = ["interessante", "ricontattare", "competitor", "fornitore"];
const SIZES: CompanySize[] = ["grande", "media", "piccola", "consorzio", "n.d."];

export function ExhibitorCard({ ex, visit, expanded, onToggleExpand, onMeasure }: Props) {
  const { toggleVisited, togglePlanned, updateVisit, customTags, addCustomTag, media } = useAppState();
  const [noteDraft, setNoteDraft] = useState(visit?.notes ?? "");
  const [newTag, setNewTag] = useState("");

  const visited = visit?.visited ?? false;
  const planned = visit?.planned ?? false;
  const tags = visit?.tags ?? [];
  const size: CompanySize = visit?.size ?? inferSize(ex);

  // Conteggio media per il badge sulla card chiusa: serve solo per dare un
  // hint visivo che ci sono allegati senza dover espandere.
  const mediaCount = useMemo(
    () => media.filter((m) => m.exhibitorId === ex.id).length,
    [media, ex.id],
  );

  const cats = (ex.categorie || "").split(" | ").filter(Boolean);

  // Measure rendered height so the parent virtualized list can size the slot
  // exactly. Without this the expanded card overlaps the items below it.
  const wrapperRef = useRef<HTMLElement>(null);
  const lastReportedH = useRef(0);
  useLayoutEffect(() => {
    if (!wrapperRef.current || !onMeasure) return;
    const el = wrapperRef.current;
    const report = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h && Math.abs(h - lastReportedH.current) > 1) {
        lastReportedH.current = h;
        onMeasure(ex.id, h);
      }
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ex.id, onMeasure, expanded]);

  // Reset the local note draft if the underlying record changes (e.g. import sync)
  useEffect(() => {
    setNoteDraft(visit?.notes ?? "");
  }, [visit?.notes]);

  return (
    <article
      ref={wrapperRef}
      className={`border-b border-neutral-200 dark:border-neutral-800 ${
        visited ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex-1 min-w-0 text-left px-4 py-3 min-h-tap flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900"
        >
          <span
            aria-hidden="true"
            className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
              visited
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          >
            {visited ? "✓" : ""}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-tight truncate">{ex.nome}</span>
            <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {[ex.citta, ex.provincia, ex.paese].filter(Boolean).join(" · ")}
              {ex.padiglione ? ` · Pad. ${ex.padiglione}` : ""}
              {ex.stand ? ` Stand ${ex.stand}` : ""}
            </span>
          </span>
          <span className="shrink-0 flex items-center gap-1">
            {mediaCount > 0 && (
              <span
                className="text-[10px] uppercase tracking-wide rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 px-1.5 py-0.5"
                aria-label={`${mediaCount} allegati`}
                title={`${mediaCount} allegati`}
              >
                📷 {mediaCount}
              </span>
            )}
            {tags.length > 0 && (
              <span className="text-[10px] uppercase tracking-wide rounded bg-brand-50 dark:bg-brand-700/30 text-brand-700 dark:text-brand-50 px-1.5 py-0.5">
                {tags.length} tag
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void togglePlanned(ex.id)}
          aria-pressed={planned}
          aria-label={planned ? "Rimuovi dal percorso" : "Aggiungi al percorso"}
          title={planned ? "Rimuovi dal percorso" : "Aggiungi al percorso"}
          className={`shrink-0 min-h-tap min-w-tap px-3 flex items-center justify-center text-xl border-l border-neutral-200 dark:border-neutral-800 ${
            planned
              ? "text-amber-500"
              : "text-neutral-300 dark:text-neutral-600 hover:text-amber-400"
          }`}
        >
          <span aria-hidden="true">{planned ? "★" : "☆"}</span>
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 text-sm">
          {/* Big visited toggle */}
          <label className="flex items-center gap-3 select-none cursor-pointer min-h-tap">
            <input
              type="checkbox"
              checked={visited}
              onChange={() => toggleVisited(ex.id)}
              className="h-6 w-6 accent-emerald-500 cursor-pointer"
              aria-label={visited ? "Segna come non visitato" : "Segna come visitato"}
            />
            <span className="font-medium">
              {visited ? "Visitato" : "Da visitare"}
              {visit?.visitedAt && (
                <span className="ml-2 text-xs text-neutral-500">
                  {new Date(visit.visitedAt).toLocaleString("it-IT", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </span>
          </label>

          <dl className="grid grid-cols-1 gap-2">
            {ex.indirizzo && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Indirizzo</dt>
                <dd>{[ex.indirizzo, ex.cap, ex.citta, ex.provincia ? `(${ex.provincia})` : "", ex.paese].filter(Boolean).join(" ")}</dd>
              </div>
            )}
            {ex.telefono && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Telefono</dt>
                <dd><a className="text-brand-500 underline" href={`tel:${ex.telefono.replace(/\s+/g, "")}`}>{ex.telefono}</a></dd>
              </div>
            )}
            {ex.email && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Email</dt>
                <dd className="break-all"><a className="text-brand-500 underline" href={`mailto:${ex.email}`}>{ex.email}</a></dd>
              </div>
            )}
            {ex.sito_web && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Sito</dt>
                <dd className="break-all"><a className="text-brand-500 underline" href={ex.sito_web} target="_blank" rel="noreferrer">{ex.sito_web}</a></dd>
              </div>
            )}
            {ex.espositore_principale && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Co-espositore di</dt>
                <dd>{ex.espositore_principale}</dd>
              </div>
            )}
            {ex.marchi && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Marchi</dt>
                <dd>{ex.marchi}</dd>
              </div>
            )}
            {cats.length > 0 && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Categorie</dt>
                <dd className="flex flex-wrap gap-1">
                  {cats.map((c) => (
                    <span key={c} className="text-xs rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5">{c}</span>
                  ))}
                </dd>
              </div>
            )}
            {ex.descrizione && (
              <div>
                <dt className="text-xs uppercase text-neutral-500">Descrizione</dt>
                <dd className="whitespace-pre-wrap">{ex.descrizione}</dd>
              </div>
            )}
          </dl>

          {/* Size override */}
          <div>
            <label className="text-xs uppercase text-neutral-500 mb-1 block" htmlFor={`size-${ex.id}`}>Grandezza</label>
            <select
              id={`size-${ex.id}`}
              value={size}
              onChange={(e) => updateVisit(ex.id, { size: e.target.value as CompanySize })}
              className="w-full min-h-tap rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-2"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>{SIZE_LABEL[s]}</option>
              ))}
            </select>
          </div>

          {/* Foto e audio */}
          <MediaSection exhibitorId={ex.id} />

          {/* Notes */}
          <div>
            <label className="text-xs uppercase text-neutral-500 mb-1 block" htmlFor={`notes-${ex.id}`}>Note</label>
            <textarea
              id={`notes-${ex.id}`}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => {
                if ((noteDraft || "") !== (visit?.notes ?? "")) {
                  void updateVisit(ex.id, { notes: noteDraft });
                }
              }}
              rows={3}
              placeholder="Appunti dalla visita..."
              className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2"
            />
          </div>

          {/* Tags */}
          <div>
            <span className="text-xs uppercase text-neutral-500 block mb-1">Tag</span>
            <div className="flex flex-wrap gap-1.5">
              {[...PRESET_TAGS, ...customTags].map((t) => {
                const on = tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on ? tags.filter((x) => x !== t) : [...tags, t];
                      void updateVisit(ex.id, { tags: next });
                    }}
                    className={`min-h-tap px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      on
                        ? "bg-brand-500 border-brand-500 text-white"
                        : "border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newTag.trim()) {
                  void addCustomTag(newTag.trim());
                  void updateVisit(ex.id, { tags: [...tags, newTag.trim()] });
                  setNewTag("");
                }
              }}
            >
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="nuovo tag custom"
                className="flex-1 min-h-tap rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2"
                aria-label="Nuovo tag custom"
              />
              <button
                type="submit"
                className="min-h-tap min-w-tap px-3 rounded bg-brand-500 text-white font-medium"
              >
                +
              </button>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}
