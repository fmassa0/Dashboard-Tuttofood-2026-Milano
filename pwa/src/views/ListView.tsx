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
import { ExhibitorCard } from "../components/ExhibitorCard";
import { FastTriage } from "../components/FastTriage";
import { FilterControls } from "../components/FilterControls";
import { applyFilters, sortExhibitors, DEFAULT_FILTERS } from "../data/filters";
import type { ListFilters } from "../data/filters";
import type { ViewName } from "../types";

const ROW_COLLAPSED = 64;
// Initial guess for the expanded card before the real measurement arrives.
// Real height is reported back from ExhibitorCard via ResizeObserver.
const ROW_EXPANDED_GUESS = 900;

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triageMode, setTriageMode] = useState(false);
  const listRef = useRef<List>(null);
  // Real measured height per card id (collapsed and expanded alike). Without this,
  // tiny pixel discrepancies between the static guess and the actual layout cause
  // adjacent rows to visually overlap on mobile.
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

  const filtered = useMemo(() => {
    const base = applyFilters(exhibitors, filters, visits);
    return sortExhibitors(base, filters.sort, visits);
  }, [exhibitors, visits, filters]);

  // Heights are keyed by exhibitor id, so they remain valid when filters change
  // the visible set — only the row positions need to be recalculated.
  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [expandedId, filtered]);

  const itemSize = useCallback(
    (index: number) => {
      const ex = filtered[index];
      if (!ex) return ROW_COLLAPSED;
      const cached = heightsRef.current.get(ex.id);
      if (cached) return cached;
      return ex.id === expandedId ? ROW_EXPANDED_GUESS : ROW_COLLAPSED;
    },
    [filtered, expandedId],
  );

  const onMeasureCard = useCallback(
    (id: string, height: number) => {
      const prev = heightsRef.current.get(id) ?? -1;
      if (Math.abs(prev - height) <= 1) return;
      heightsRef.current.set(id, height);
      const idx = filtered.findIndex((e) => e.id === id);
      if (idx >= 0) listRef.current?.resetAfterIndex(idx);
    },
    [filtered],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-neutral-950/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 pt-safe">
        <FilterControls
          filters={filters}
          onChange={setFilters}
          exhibitors={exhibitors}
        />

        <div className="px-4 py-1 text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center justify-between gap-2">
          <span>
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
          </span>
          {filtered.length > 0 && (
            <button
              type="button"
              onClick={() => setTriageMode(true)}
              className="min-h-tap px-3 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center gap-1"
              title="Triage rapido: scorri una card alla volta per pianificare velocemente"
            >
              <span aria-hidden="true">🃏</span>
              Triage rapido
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

      {triageMode && (
        <FastTriage
          exhibitors={filtered}
          onExit={() => setTriageMode(false)}
        />
      )}
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
