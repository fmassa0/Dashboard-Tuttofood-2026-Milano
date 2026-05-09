import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useAppState } from "../state";
import { inferSize, SIZE_LABEL } from "../data/heuristics";
import { blobToBundle, bundleToBlob } from "../data/storage";
import type { MergeStats } from "../data/storage";
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
  const { exhibitors, visits, exportSync, importSync } = useAppState();
  const [busy, setBusy] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

      <hr className="border-neutral-200 dark:border-neutral-800" />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Sincronizza con un altro dispositivo</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            Esporta lo stato (visite, note, tag) in un file <code>.json</code>, mandalo all&apos;altro
            telefono via WhatsApp/email, poi importalo lì. Il merge è
            automatico: <strong>nessuna visita viene persa</strong>, i tag vengono uniti, le
            note più recenti vincono.
          </p>
        </div>

        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("sync-out");
            setSyncMsg(null);
            try {
              const bundle = await exportSync();
              const blob = bundleToBlob(bundle);
              const url = URL.createObjectURL(blob);
              const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
              const a = document.createElement("a");
              a.href = url;
              a.download = `tf26-sync_${stamp}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              setSyncMsg({ kind: "ok", text: "File scaricato. Inviarlo all'altro dispositivo." });
            } catch (e) {
              setSyncMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
            } finally {
              setBusy(null);
            }
          }}
          className="w-full min-h-tap rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold py-3 disabled:opacity-50"
        >
          {busy === "sync-out" ? "Genero..." : "Esporta stato (per condividere)"}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy("sync-in");
            setSyncMsg(null);
            try {
              const bundle = await blobToBundle(file);
              const stats: MergeStats = await importSync(bundle);
              setSyncMsg({
                kind: "ok",
                text: `Import OK — aggiunti ${stats.added}, aggiornati ${stats.updated}, invariati ${stats.unchanged}, nuovi tag ${stats.newTags}.`,
              });
            } catch (err) {
              setSyncMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
            } finally {
              setBusy(null);
              if (fileRef.current) fileRef.current.value = "";
            }
          }}
        />
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
          className="w-full min-h-tap rounded-lg border-2 border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-semibold py-3 disabled:opacity-50"
        >
          {busy === "sync-in" ? "Importo..." : "Importa stato da file"}
        </button>

        {syncMsg && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-md p-2 text-sm ${
              syncMsg.kind === "ok"
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
            }`}
          >
            {syncMsg.text}
          </div>
        )}

        <details className="text-xs text-neutral-600 dark:text-neutral-400">
          <summary className="cursor-pointer min-h-tap py-1">Come funziona il merge</summary>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            <li>Se uno dei due dispositivi ha segnato un espositore come visitato, resta visitato dopo il merge.</li>
            <li>Per le note, vince la più recente (timestamp dell&apos;ultima visita).</li>
            <li>I tag vengono uniti, mai sottratti.</li>
            <li>Si possono importare più file in sequenza, l&apos;operazione è idempotente.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
