import { get, set, createStore } from "idb-keyval";
import type { AllVisits, VisitState } from "../types";

// Dedicated DB so we don't collide with anything else.
const store = createStore("tf26-pwa", "kv");

const VISITS_KEY = "visits.v1";
const TAGS_KEY = "tags.v1";

export async function loadVisits(): Promise<AllVisits> {
  return ((await get(VISITS_KEY, store)) as AllVisits | undefined) ?? {};
}

export async function saveVisits(visits: AllVisits): Promise<void> {
  await set(VISITS_KEY, visits, store);
}

export async function patchVisit(
  id: string,
  patch: Partial<VisitState>,
): Promise<AllVisits> {
  const all = await loadVisits();
  const current = all[id] ?? { visited: false };
  const next: VisitState = { ...current, ...patch };
  // toggling visited true sets timestamp if missing
  if (patch.visited === true && !next.visitedAt) next.visitedAt = Date.now();
  all[id] = next;
  await saveVisits(all);
  return all;
}

export async function loadCustomTags(): Promise<string[]> {
  return ((await get(TAGS_KEY, store)) as string[] | undefined) ?? [];
}

export async function saveCustomTags(tags: string[]): Promise<void> {
  await set(TAGS_KEY, Array.from(new Set(tags)), store);
}
