import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { loadExhibitors } from "./data/loader";
import {
  loadCustomTags,
  loadVisits,
  patchVisit,
  saveCustomTags,
} from "./data/storage";
import type { AllVisits, Exhibitor, VisitState } from "./types";

interface AppState {
  exhibitors: Exhibitor[];
  loading: boolean;
  error: string | null;
  visits: AllVisits;
  customTags: string[];
  toggleVisited: (id: string) => Promise<void>;
  updateVisit: (id: string, patch: Partial<VisitState>) => Promise<void>;
  addCustomTag: (tag: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [visits, setVisits] = useState<AllVisits>({});
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const [list, v, tags] = await Promise.all([
          loadExhibitors(),
          loadVisits(),
          loadCustomTags(),
        ]);
        if (canceled) return;
        setExhibitors(list);
        setVisits(v);
        setCustomTags(tags);
      } catch (e) {
        if (!canceled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const updateVisit = useCallback(
    async (id: string, patch: Partial<VisitState>) => {
      const next = await patchVisit(id, patch);
      setVisits({ ...next });
    },
    [],
  );

  const toggleVisited = useCallback(
    async (id: string) => {
      const current = visits[id]?.visited ?? false;
      await updateVisit(id, {
        visited: !current,
        visitedAt: !current ? Date.now() : visits[id]?.visitedAt,
      });
    },
    [visits, updateVisit],
  );

  const addCustomTag = useCallback(
    async (tag: string) => {
      const t = tag.trim();
      if (!t) return;
      const next = Array.from(new Set([...customTags, t]));
      setCustomTags(next);
      await saveCustomTags(next);
    },
    [customTags],
  );

  const value = useMemo<AppState>(
    () => ({
      exhibitors,
      loading,
      error,
      visits,
      customTags,
      toggleVisited,
      updateVisit,
      addCustomTag,
    }),
    [exhibitors, loading, error, visits, customTags, toggleVisited, updateVisit, addCustomTag],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState fuori dal provider");
  return v;
}
