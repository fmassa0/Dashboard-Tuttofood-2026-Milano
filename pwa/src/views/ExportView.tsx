import { useState } from "react";
import * as XLSX from "xlsx";
import { useAppState } from "../state";
import { inferSize, SIZE_LABEL } from "../data/heuristics";
import type { Exhibitor, VisitState } from "../types";

const HEADERS = [
  "nome",
  "padiglione",
  "stand",
  "citta",
  "provincia",
  "regione",
  "paese",
  "telefono",
  "email",
  "sito_web",
  "indirizzo",
  "marchi",
  "categorie",
  "espositore_principale",
  "coespositore",
  "url_canonical",
];

function toRow(e: Exhibitor, v: VisitState | undefined) {
  const size = v?.size ?? inferSize(e);
  return {
    visitato: v?.visited ? "SI" : "",
    visitato_il: v?.visitedAt ? new Date(v.visitedAt).toISOString() : "",
    note: v?.notes ?? "",
    tag: (v?.tags ?? []).join(", "),
    grandezza: SIZE_LABEL[size],
    ...Object.fromEntries(HEADERS.map((h) => [h, (e as unknown as Record<string, string>)[h] ?? ""])),
  };
}

function downloadXlsx(rows: Record<string, unknown>[], filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  // freeze header
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  ws["!autofilter"] = { ref: ws["!ref"] ?? "A1" };
  XLSX.utils.book_append_sheet(wb, ws, "Espositori");
  XLSX.writeFile(wb, filename, { compression: true });
}

export function ExportView() {
  const { exhibitors, visits } = useAppState();
  const [busy, setBusy] = useState<string | null>(null);

  const visitedCount = exhibitors.filter((e) => visits[e.id]?.visited).length;
  const annotatedCount = exhibitors.filter(
    (e) => visits[e.id] && (visits[e.id]!.visited || visits[e.id]!.notes || (visits[e.id]!.tags?.length ?? 0) > 0),
  ).length;

  const exportVisited = async () => {
    setBusy("visited");
    try {
      const rows = exhibitors
        .filter((e) => visits[e.id] && (visits[e.id]!.visited || visits[e.id]!.notes || (visits[e.id]!.tags?.length ?? 0) > 0))
        .map((e) => toRow(e, visits[e.id]));
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      downloadXlsx(rows, `tuttofood-2026_visitati_${stamp}.xlsx`);
    } finally {
      setBusy(null);
    }
  };

  const exportAll = async () => {
    setBusy("all");
    try {
      const rows = exhibitors.map((e) => toRow(e, visits[e.id]));
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      downloadXlsx(rows, `tuttofood-2026_completo_${stamp}.xlsx`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 pt-safe pb-2 space-y-4">
      <h1 className="text-xl font-bold">Export</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        I file vengono generati nel browser e scaricati. Nessun dato lascia il tuo dispositivo.
      </p>

      <button
        type="button"
        disabled={busy !== null || annotatedCount === 0}
        onClick={exportVisited}
        className="w-full min-h-tap rounded-lg bg-brand-500 text-white font-semibold py-3 disabled:opacity-50"
      >
        {busy === "visited" ? "Genero..." : `Esporta i miei dati (${annotatedCount} con note/visita)`}
      </button>

      <button
        type="button"
        disabled={busy !== null}
        onClick={exportAll}
        className="w-full min-h-tap rounded-lg border-2 border-brand-500 text-brand-500 font-semibold py-3 disabled:opacity-50"
      >
        {busy === "all" ? "Genero..." : `Esporta tutti (${exhibitors.length} espositori)`}
      </button>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
        <div className="font-semibold mb-1">Riepilogo</div>
        <ul className="space-y-0.5 text-neutral-700 dark:text-neutral-300">
          <li>Espositori in DB: <strong>{exhibitors.length}</strong></li>
          <li>Visitati: <strong>{visitedCount}</strong></li>
          <li>Con note o tag: <strong>{annotatedCount}</strong></li>
        </ul>
      </div>
    </div>
  );
}
