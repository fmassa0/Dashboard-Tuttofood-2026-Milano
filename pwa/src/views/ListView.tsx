import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { VariableSizeList as List } from "react-window";
import { useAppState } from "../state";
import { useDebounce } from "../hooks/useDebounce";
import { ExhibitorCard } from "../components/ExhibitorCard";
import { inferSize, SIZE_LABEL } from "../data/heuristics";
import type { CompanySize, Exhibitor, ViewName } from "../types";

type SortKey = "alpha" | "citta" | "unvisited";
type PaeseFilter = "all" | "it" | "estero";

const ROW_COLLAPSED = 64;
// Initial guess for the expanded card before the real measurement arrives.
// Real height is reported back from ExhibitorCard via ResizeObserver.
const ROW_EXPANDED_GUESS = 900;

export interface ListFilters {
  search: string;
  regioni: string[];
  paeseFilter: PaeseFilter;
  padiglioni: string[];
  categorie: string[];
  sizes: CompanySize[];
  sort: SortKey;
}

const DEFAULT_FILTERS: ListFilters = {
  search: "",
  regioni: [],
  paeseFilter: "all",
  padiglioni: [],
  categorie: [],
  sizes: [],
  sort: "alpha",
};

interface Props {
  initialPadiglione?: string;
  setView: (v: ViewName) => void;
}

export function ListView({ initialPadiglione, setView }: Props) {
  const { exhibitors, visits } = useAppState();
  const [filters, setFilters] = useState<ListFilters>(() => ({
    ...DEFAULT_FILTERS,
    padiglioni: initialPadiglione ? [initialPadiglione] : [],
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 200);
  const listRef = useRef<List>(null);
  // Heights reported by each rendered card. Only the expanded one differs from COLLAPSED.
  const heightsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (initialPadiglione) {
      setFilters((f) =>
        f.padiglioni.includes(initialPadiglione)
          ? f
          : { ...f, padiglioni: [...f.padiglioni, initialPadiglione] },
      );
    }
  }, [initialPadiglione]);

  useEffect(() => {
    setFilters((f) => ({ ...f, search: debouncedSearch }));
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

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const reg = new Set(filters.regioni);
    const pads = new Set(filters.padiglioni);
    const cats = new Set(filters.categorie);
    const sizes = new Set(filters.sizes);

    const result = exhibitors.filter((e) => {
      if (q) {
        const hay =
          (e.nome + " " + e.citta + " " + e.descrizione + " " + e.marchi).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (reg.size && !reg.has(e.regione)) return false;
      if (filters.paeseFilter === "it") {
        if (!/^ITALIA|ITALY$/i.test(e.paese)) return false;
      } else if (filters.paeseFilter === "estero") {
        if (/^ITALIA|ITALY$/i.test(e.paese)) return false;
      }
      if (pads.size && !pads.has(e.padiglione)) return false;
      if (cats.size) {
        const ecats = (e.categorie || "").split(" | ");
        if (!ecats.some((c) => cats.has(c))) return false;
      }
      if (sizes.size) {
        const s = visits[e.id]?.size ?? inferSize(e);
        if (!sizes.has(s)) return false;
      }
      return true;
    });

    const cmp = (a: Exhibitor, b: Exhibitor) => {
      switch (filters.sort) {
        case "citta":
          return (a.citta || "ZZZ").localeCompare(b.citta || "ZZZ") || a.nome.localeCompare(b.nome);
        case "unvisited": {
          const av = visits[a.id]?.visited ? 1 : 0;
          const bv = visits[b.id]?.visited ? 1 : 0;
          return av - bv || a.nome.localeCompare(b.nome);
        }
        default:
          return a.nome.localeCompare(b.nome);
      }
    };
    return result.sort(cmp);
  }, [exhibitors, visits, filters]);

  // react-window: invalida la cache delle altezze quando cambia l espansione
  // o l'insieme filtrato. Le misurazioni reali arrivano via onMeasureCard.
  useEffect(() => {
    // Discard cached measurements: the previous expanded card no longer renders.
    heightsRef.current.clear();
    listRef.current?.resetAfterIndex(0);
  }, [expandedId, filtered.length]);

  const itemSize = useCallback(
    (index: number) => {
      const ex = filtered[index];
      if (!ex) return ROW_COLLAPSED;
      if (ex.id === expandedId) {
        return heightsRef.current.get(ex.id) ?? ROW_EXPANDED_GUESS;
      }
      return ROW_COLLAPSED;
    },
    [filtered, expandedId],
  );

  const onMeasureCard = useCallback(
    (id: string, height: number) => {
      // Only the expanded one needs precise measurement; collapsed rows are uniform.
      if (id !== expandedId) return;
      const prev = heightsRef.current.get(id) ?? -1;
      if (Math.abs(prev - height) <= 1) return;
      heightsRef.current.set(id, height);
      const idx = filtered.findIndex((e) => e.id === id);
      if (idx >= 0) listRef.current?.resetAfterIndex(idx);
    },
    [expandedId, filtered],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-950/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 pt-safe">
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
            {(filters.regioni.length + filters.padiglioni.length + filters.categorie.length + filters.sizes.length) > 0 && (
              <span className="ml-1 inline-flex items-center justify-center text-xs bg-brand-500 text-white rounded-full px-1.5">
                {filters.regioni.length + filters.padiglioni.length + filters.categorie.length + filters.sizes.length}
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
            <FilterRow label="Paese">
              <div className="flex gap-1.5 flex-wrap">
                {(["all", "it", "estero"] as PaeseFilter[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={filters.paeseFilter === p}
                    onClick={() => setFilters({ ...filters, paeseFilter: p })}
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
                    onClick={() => setFilters({ ...filters, sort: k })}
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

            <FilterRow label="Grandezza">
              <ChipMulti
                values={filters.sizes}
                options={(["grande", "media", "piccola", "consorzio", "n.d."] as CompanySize[]).map((s) => ({ id: s, label: SIZE_LABEL[s] }))}
                onChange={(next) => setFilters({ ...filters, sizes: next as CompanySize[] })}
              />
            </FilterRow>

            <FilterRow label={`Padiglione (${allPadiglioni.length})`}>
              <ChipMulti
                values={filters.padiglioni}
                options={allPadiglioni.map((p) => ({ id: p, label: `Pad. ${p}` }))}
                onChange={(next) => setFilters({ ...filters, padiglioni: next })}
              />
            </FilterRow>

            <FilterRow label={`Regione (${allRegioni.length})`}>
              <ChipMulti
                values={filters.regioni}
                options={allRegioni.map((r) => ({ id: r, label: r }))}
                onChange={(next) => setFilters({ ...filters, regioni: next })}
              />
            </FilterRow>

            <FilterRow label={`Categoria (${allCategorie.length})`}>
              <ScrollableMulti
                values={filters.categorie}
                options={allCategorie}
                onChange={(next) => setFilters({ ...filters, categorie: next })}
              />
            </FilterRow>

            <button
              type="button"
              onClick={() => {
                setFilters(DEFAULT_FILTERS);
                setSearchInput("");
              }}
              className="min-h-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-medium"
            >
              Pulisci tutto
            </button>
          </div>
        )}

        <div className="px-4 py-1 text-xs text-neutral-500 dark:text-neutral-400">
          {filtered.length} di {exhibitors.length} espositori
          {initialPadiglione && (
            <button
              type="button"
              onClick={() => setView("map")}
              className="ml-2 text-brand-500 underline"
            >
              ← Torna alla mappa
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <AutoSizedList
          ref={listRef}
          itemCount={filtered.length}
          itemSize={itemSize}
        >
          {({ index, style }) => {
            const ex = filtered[index];
            return (
              <div style={style}>
                <ExhibitorCard
                  ex={ex}
                  visit={visits[ex.id]}
                  expanded={ex.id === expandedId}
                  onToggleExpand={() => setExpandedId(expandedId === ex.id ? null : ex.id)}
                  onMeasure={onMeasureCard}
                />
              </div>
            );
          }}
        </AutoSizedList>
      </div>
    </div>
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

const AutoSizedList = forwardRef<List, {
  itemCount: number;
  itemSize: (index: number) => number;
  children: (props: { index: number; style: CSSProperties }) => ReactNode;
}>(function AutoSizedList({ itemCount, itemSize, children }, ref) {
  const [height, setHeight] = useState(600);
  const wrapper = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!wrapper.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setHeight(e.contentRect.height);
    });
    ro.observe(wrapper.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapper} className="h-full w-full">
      <List
        ref={ref}
        height={height}
        width="100%"
        itemCount={itemCount}
        itemSize={itemSize}
        overscanCount={4}
      >
        {({ index, style }) => <>{children({ index, style })}</>}
      </List>
    </div>
  );
});
