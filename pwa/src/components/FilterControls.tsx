import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { SIZE_LABEL } from "../data/heuristics";
import {
  DEFAULT_FILTERS,
  activeFilterCount,
} from "../data/filters";
import type { ListFilters, PaeseFilter, SortKey } from "../data/filters";
import type { CompanySize, Exhibitor } from "../types";

interface FilterControlsProps {
  filters: ListFilters;
  onChange: (next: ListFilters) => void;
  exhibitors: Exhibitor[];
  /** Nasconde la riga del sort (utile dove l'ordine è imposto, es. percorso) */
  hideSort?: boolean;
  /** Nasconde il toggle "Solo nel percorso" (utile dove è già implicito) */
  hideOnlyPlanned?: boolean;
}

export function FilterControls({
  filters,
  onChange,
  exhibitors,
  hideSort = false,
  hideOnlyPlanned = false,
}: FilterControlsProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 200);

  // Mantengo il search input allineato se i filtri vengono resettati dal padre.
  useEffect(() => {
    if (filters.search !== searchInput) {
      // Solo quando il padre fa reset (search vuota) sincronizzo l'input.
      // Senza questo, "Pulisci tutto" non svuoterebbe il box di ricerca.
      if (filters.search === "") setSearchInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onChange({ ...filters, search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const allRegioni = useMemo(
    () => Array.from(new Set(exhibitors.map((e) => e.regione).filter(Boolean))).sort(),
    [exhibitors],
  );
  const allPadiglioni = useMemo(
    () =>
      Array.from(new Set(exhibitors.map((e) => e.padiglione).filter(Boolean))).sort(
        (a, b) => Number(a) - Number(b) || a.localeCompare(b),
      ),
    [exhibitors],
  );
  const allCategorie = useMemo(() => {
    const s = new Set<string>();
    for (const e of exhibitors) {
      for (const c of (e.categorie || "").split(" | ")) {
        if (c) s.add(c);
      }
    }
    return Array.from(s).sort();
  }, [exhibitors]);

  const provinceForSelectedRegioni = useMemo(() => {
    if (filters.regioni.length === 0) return [] as string[];
    const reg = new Set(filters.regioni);
    const s = new Set<string>();
    for (const e of exhibitors) {
      if (reg.has(e.regione) && e.provincia) s.add(e.provincia);
    }
    return Array.from(s).sort();
  }, [exhibitors, filters.regioni]);

  // Quando cambiano le regioni, rimuovi dalle province selezionate quelle che
  // non appartengono più al set disponibile.
  useEffect(() => {
    if (filters.province.length === 0) return;
    const allowed = new Set(provinceForSelectedRegioni);
    const pruned = filters.province.filter((p) => allowed.has(p));
    if (pruned.length !== filters.province.length) {
      onChange({ ...filters, province: pruned });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceForSelectedRegioni]);

  const badge = activeFilterCount(filters);

  return (
    <>
      <div className="px-4 py-2 flex gap-2 items-center">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Cerca nome, città, descrizione..."
          aria-label="Cerca"
          className="flex-1 min-h-tap rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-controls="filters-panel"
          className="min-h-tap min-w-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 font-medium"
        >
          Filtri
          {badge > 0 && (
            <span className="ml-1 inline-flex items-center justify-center text-xs bg-brand-500 text-white rounded-full px-1.5">
              {badge}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div
          id="filters-panel"
          className="px-4 pb-3 space-y-3 text-sm border-t border-neutral-200 dark:border-neutral-800 overflow-y-auto overscroll-contain"
          style={{ maxHeight: "calc(100svh - 13rem)" }}
        >
          {!hideOnlyPlanned && (
            <FilterRow label="Selezione">
              <button
                type="button"
                aria-pressed={filters.onlyPlanned}
                onClick={() => onChange({ ...filters, onlyPlanned: !filters.onlyPlanned })}
                className={`min-h-tap px-3 rounded-full border text-xs font-medium inline-flex items-center gap-1 ${
                  filters.onlyPlanned
                    ? "bg-amber-500 border-amber-500 text-white"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <span aria-hidden="true">★</span>
                Solo nel percorso
              </button>
            </FilterRow>
          )}

          <FilterRow label="Paese">
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "it", "estero"] as PaeseFilter[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={filters.paeseFilter === p}
                  onClick={() => onChange({ ...filters, paeseFilter: p })}
                  className={`min-h-tap px-3 rounded-full border text-xs font-medium ${
                    filters.paeseFilter === p
                      ? "bg-brand-500 border-brand-500 text-white"
                      : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  {p === "all" ? "tutti" : p === "it" ? "Italia" : "estero"}
                </button>
              ))}
            </div>
          </FilterRow>

          {!hideSort && (
            <FilterRow label="Sort">
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["alpha", "A→Z"],
                  ["citta", "città"],
                  ["unvisited", "non ancora visitati"],
                ] as Array<[SortKey, string]>).map(([k, lab]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={filters.sort === k}
                    onClick={() => onChange({ ...filters, sort: k })}
                    className={`min-h-tap px-3 rounded-full border text-xs font-medium ${
                      filters.sort === k
                        ? "bg-brand-500 border-brand-500 text-white"
                        : "border-neutral-300 dark:border-neutral-700"
                    }`}
                  >
                    {lab}
                  </button>
                ))}
              </div>
            </FilterRow>
          )}

          <FilterRow label="Grandezza">
            <ChipMulti
              values={filters.sizes}
              options={(["grande", "media", "piccola", "consorzio", "n.d."] as CompanySize[]).map((s) => ({ id: s, label: SIZE_LABEL[s] }))}
              onChange={(next) => onChange({ ...filters, sizes: next as CompanySize[] })}
            />
          </FilterRow>

          <FilterRow label={`Padiglione (${allPadiglioni.length})`}>
            <ChipMulti
              values={filters.padiglioni}
              options={allPadiglioni.map((p) => ({ id: p, label: `Pad. ${p}` }))}
              onChange={(next) => onChange({ ...filters, padiglioni: next })}
            />
          </FilterRow>

          <FilterRow label={`Regione (${allRegioni.length})`}>
            <ChipMulti
              values={filters.regioni}
              options={allRegioni.map((r) => ({ id: r, label: r }))}
              onChange={(next) => onChange({ ...filters, regioni: next })}
            />
          </FilterRow>

          {provinceForSelectedRegioni.length > 0 && (
            <FilterRow label={`Provincia (${provinceForSelectedRegioni.length})`}>
              <ChipMulti
                values={filters.province}
                options={provinceForSelectedRegioni.map((p) => ({ id: p, label: p }))}
                onChange={(next) => onChange({ ...filters, province: next })}
              />
            </FilterRow>
          )}

          <FilterRow label={`Categoria (${allCategorie.length})`}>
            <ScrollableMulti
              values={filters.categorie}
              options={allCategorie}
              onChange={(next) => onChange({ ...filters, categorie: next })}
            />
          </FilterRow>

          <button
            type="button"
            onClick={() => {
              // Preservo i flag che il chiamante ha forzato (es. sort/onlyPlanned
              // nascosti). Resetto solo quelli visibili.
              onChange({
                ...DEFAULT_FILTERS,
                sort: hideSort ? filters.sort : DEFAULT_FILTERS.sort,
                onlyPlanned: hideOnlyPlanned ? filters.onlyPlanned : DEFAULT_FILTERS.onlyPlanned,
              });
              setSearchInput("");
            }}
            className="min-h-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-medium"
          >
            Pulisci tutto
          </button>
        </div>
      )}
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function ChipMulti({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: Array<{ id: string; label: string }>;
  onChange: (next: string[]) => void;
}) {
  const set = new Set(values);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = set.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? values.filter((v) => v !== o.id) : [...values, o.id])
            }
            className={`min-h-tap px-3 rounded-full border text-xs font-medium ${
              on ? "bg-brand-500 border-brand-500 text-white" : "border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ScrollableMulti({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const set = new Set(values);
  const visible = options.filter((o) => o.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="filtra categorie..."
        className="w-full min-h-tap rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 mb-1 text-xs"
      />
      <div className="flex flex-wrap gap-1.5">
        {visible.map((c) => {
          const on = set.has(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? values.filter((v) => v !== c) : [...values, c])
              }
              className={`min-h-tap px-3 rounded-full border text-xs font-medium ${
                on ? "bg-brand-500 border-brand-500 text-white" : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
