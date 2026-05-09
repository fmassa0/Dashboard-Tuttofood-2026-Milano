import type { Exhibitor } from "../types";

let cache: Exhibitor[] | null = null;

export async function loadExhibitors(): Promise<Exhibitor[]> {
  if (cache) return cache;
  // Resolve relative to the deployed base (works on GitHub Pages too).
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const url = `${base}/data/espositori.json`;
  const r = await fetch(url, { cache: "force-cache" });
  if (!r.ok) throw new Error(`Impossibile caricare espositori (${r.status})`);
  const data = (await r.json()) as Exhibitor[];
  cache = data;
  return data;
}
