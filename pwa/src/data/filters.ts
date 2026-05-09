import type { AllVisits, CompanySize, Exhibitor } from "../types";
import { inferSize } from "./heuristics";

export type SortKey = "alpha" | "citta" | "unvisited";
export type PaeseFilter = "all" | "it" | "estero";

export interface ListFilters {
  search: string;
  regioni: string[];
  province: string[];
  paeseFilter: PaeseFilter;
  padiglioni: string[];
  categorie: string[];
  sizes: CompanySize[];
  sort: SortKey;
  onlyPlanned: boolean;
}

export const DEFAULT_FILTERS: ListFilters = {
  search: "",
  regioni: [],
  province: [],
  paeseFilter: "all",
  padiglioni: [],
  categorie: [],
  sizes: [],
  sort: "alpha",
  onlyPlanned: false,
};

export function activeFilterCount(f: ListFilters): number {
  return (
    f.regioni.length +
    f.province.length +
    f.padiglioni.length +
    f.categorie.length +
    f.sizes.length +
    (f.onlyPlanned ? 1 : 0) +
    (f.paeseFilter !== "all" ? 1 : 0)
  );
}

/**
 * Filtra (senza ordinare) la lista espositori secondo i criteri attivi.
 * Il sort è gestito separatamente perché alcune view (come il percorso)
 * lo sostituiscono con un'ottimizzazione propria.
 */
export function applyFilters(
  exhibitors: Exhibitor[],
  filters: ListFilters,
  visits: AllVisits,
): Exhibitor[] {
  const q = filters.search.trim().toLowerCase();
  const reg = new Set(filters.regioni);
  const prov = new Set(filters.province);
  const pads = new Set(filters.padiglioni);
  const cats = new Set(filters.categorie);
  const sizes = new Set(filters.sizes);

  return exhibitors.filter((e) => {
    if (filters.onlyPlanned && !visits[e.id]?.planned) return false;
    if (q) {
      const hay =
        (e.nome + " " + e.citta + " " + e.descrizione + " " + e.marchi).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (reg.size && !reg.has(e.regione)) return false;
    if (prov.size && !prov.has(e.provincia)) return false;
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
}

export function sortExhibitors(
  list: Exhibitor[],
  sort: SortKey,
  visits: AllVisits,
): Exhibitor[] {
  const cmp = (a: Exhibitor, b: Exhibitor) => {
    switch (sort) {
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
  return list.slice().sort(cmp);
}
