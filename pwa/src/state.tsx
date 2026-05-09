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
  exportBundle,
  importBundle,
  loadCustomTags,
  loadSettings,
  loadVisits,
  patchVisit,
  saveCustomTags,
  saveSettings,
} from "./data/storage";
import type { MergeStats, SyncBundle } from "./data/storage";
import type { AllVisits, AppSettings, Exhibitor, VisitState } from "./types";

interface AppState {
  exhibitors: Exhibitor[];
  loading: boolean;
  error: string | null;
  visits: AllVisits;
  customTags: string[];
  settings: AppSettings;
  toggleVisited: (id: string) => Promise<void>;
  togglePlanned: (id: string) => Promise<void>;
  updateVisit: (id: string, patch: Partial<VisitState>) => Promise<void>;
  addCustomTag: (tag: string) => Promise<void>;
  setRouteStart: (padiglione: string) => Promise<void>;
  exportSync: () => Promise<SyncBundle>;
  importSync: (bundle: SyncBundle) => Promise<MergeStats>;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [visits, setVisits] = useState<AllVisits>({});
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const [list, v, tags, s] = await Promise.all([
          loadExhibitors(),
          loadVisits(),
          loadCustomTags(),
          loadSettings(),
        ]);
        if (canceled) return;
        setExhibitors(list);
        setVisits(v);
        setCustomTags(tags);
        setSettings(s);
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

  const togglePlanned = useCallback(
    async (id: string) => {
      const current = visits[id]?.planned ?? false;
      await updateVisit(id, { planned: !current });
    },
    [visits, updateVisit],
  );

  const setRouteStart = useCallback(
    async (padiglione: string) => {
      const next: AppSettings = { ...settings, routeStart: padiglione };
      setSettings(next);
      await saveSettings(next);
    },
    [settings],
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

  const exportSync = useCallback(() => exportBundle(), []);

  const importSync = useCallback(async (bundle: SyncBundle) => {
    const stats = await importBundle(bundle);
    // ricarica lo stato in memoria dopo il merge
    const [v, t, s] = await Promise.all([loadVisits(), loadCustomTags(), loadSettings()]);
    setVisits(v);
    setCustomTags(t);
    setSettings(s);
    return stats;
  }, []);

  const value = useMemo<AppState>(
    () => ({
      exhibitors,
      loading,
      error,
      visits,
      customTags,
      settings,
      toggleVisited,
      togglePlanned,
      updateVisit,
      addCustomTag,
      setRouteStart,
      exportSync,
      importSync,
    }),
    [exhibitors, loading, error, visits, customTags, settings, toggleVisited, togglePlanned, updateVisit, addCustomTag, setRouteStart, exportSync, importSync],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState fuori dal provider");
  return v;
}
