import type { Exhibitor } from "../types";
import { HALL_CENTROIDS, distance } from "./halls";

export interface RouteStop {
  hall: string;
  exhibitors: Exhibitor[];
}

export interface OptimizedRoute {
  stops: RouteStop[];
  /** padiglioni richiesti dal set ma sconosciuti (non in HALL_CENTROIDS) */
  unknownHalls: string[];
  /** stima della distanza totale percorsa fra padiglioni, in unità "% pianta" */
  totalDistance: number;
}

/** Natural sort dei numeri di stand: "A12" < "A100", "B" < "C". */
function compareStand(a: string, b: string): number {
  return a.localeCompare(b, "it", { numeric: true, sensitivity: "base" });
}

/**
 * Ordina i padiglioni con greedy nearest-neighbor a partire da `start` e ordina
 * gli espositori dentro ogni padiglione per stand. Per 10 padiglioni nearest-
 * neighbor è già ottimo nella pratica; non vale la pena un TSP esatto.
 */
export function optimizeRoute(
  planned: Exhibitor[],
  start: string,
): OptimizedRoute {
  const byHall = new Map<string, Exhibitor[]>();
  for (const ex of planned) {
    const k = ex.padiglione || "?";
    const arr = byHall.get(k) ?? [];
    arr.push(ex);
    byHall.set(k, arr);
  }

  const knownHalls: string[] = [];
  const unknownHalls: string[] = [];
  for (const h of byHall.keys()) {
    if (HALL_CENTROIDS[h]) knownHalls.push(h);
    else unknownHalls.push(h);
  }

  // Nearest-neighbor partendo dal centroide di `start`. Se start è esso stesso
  // un padiglione da visitare lo prendiamo per primo (distanza 0).
  const startPoint = HALL_CENTROIDS[start] ?? HALL_CENTROIDS[knownHalls[0] ?? "12"];
  const remaining = new Set(knownHalls);
  const ordered: string[] = [];
  let cur = startPoint;
  let totalDistance = 0;

  while (remaining.size > 0) {
    let bestId: string | null = null;
    let bestD = Infinity;
    for (const h of remaining) {
      const d = distance(cur, HALL_CENTROIDS[h]);
      if (d < bestD) {
        bestD = d;
        bestId = h;
      }
    }
    if (!bestId) break;
    ordered.push(bestId);
    remaining.delete(bestId);
    totalDistance += bestD;
    cur = HALL_CENTROIDS[bestId];
  }

  // Append unknown halls al fondo, in ordine alfanumerico
  unknownHalls.sort((a, b) => a.localeCompare(b, "it", { numeric: true }));

  const stops: RouteStop[] = [...ordered, ...unknownHalls].map((hall) => ({
    hall,
    exhibitors: (byHall.get(hall) ?? []).slice().sort((a, b) =>
      compareStand(a.stand || "", b.stand || ""),
    ),
  }));

  return { stops, unknownHalls, totalDistance };
}
