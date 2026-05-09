import { useEffect, useRef, useState } from "react";
import { useAppState } from "../state";
import type { ExtractedFields, OcrProgress } from "../data/ocr";

interface ButtonProps {
  exhibitorId: string;
}

/**
 * Bottone "Scan biglietto" da mostrare nella card espansa. Apre direttamente
 * il file picker (camera ambiente su mobile); quando l'utente ha scelto/scattato
 * la foto, mostra il modal di scan con OCR + estrazione contatti.
 */
export function BizCardScanButton({ exhibitorId }: ButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setImageBlob(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="min-h-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium inline-flex items-center gap-1"
        title="Fotografa il biglietto da visita: l'app riconosce email/telefono/web e li propone"
      >
        <span aria-hidden="true">📇</span>
        Scan biglietto
      </button>
      {imageBlob && (
        <BizCardScanModal
          exhibitorId={exhibitorId}
          imageBlob={imageBlob}
          onClose={() => setImageBlob(null)}
        />
      )}
    </>
  );
}

interface ModalProps {
  exhibitorId: string;
  imageBlob: Blob;
  onClose: () => void;
}

function BizCardScanModal({ exhibitorId, imageBlob, onClose }: ModalProps) {
  const { visits, updateVisit, addPhoto } = useAppState();
  const [progress, setProgress] = useState<OcrProgress>({
    status: "starting",
    progress: 0,
  });
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Selezioni utente
  const [pickedEmails, setPickedEmails] = useState<Set<string>>(new Set());
  const [pickedPhones, setPickedPhones] = useState<Set<string>>(new Set());
  const [pickedWebsites, setPickedWebsites] = useState<Set<string>>(new Set());
  const [textDraft, setTextDraft] = useState("");
  const [includeRawText, setIncludeRawText] = useState(false);

  const previewUrl = useObjectUrl(imageBlob);

  // Salviamo la foto e lanciamo l'OCR in parallelo. L'utente vede subito la
  // preview mentre tesseract lavora; se chiude prima di completare, almeno la
  // foto è già stata aggiunta agli allegati.
  useEffect(() => {
    let cancelled = false;
    addPhoto(exhibitorId, imageBlob).catch(() => {
      // ignora: se la compressione fallisce non blocchiamo l'OCR
    });

    (async () => {
      try {
        const { runOcr, parseFields } = await import("../data/ocr");
        const text = await runOcr(imageBlob, (p) => {
          if (!cancelled) setProgress(p);
        });
        if (cancelled) return;
        const fields = parseFields(text);
        setExtracted(fields);
        // Pre-spunto tutto: l'utente toglie quello che non vuole
        setPickedEmails(new Set(fields.emails));
        setPickedPhones(new Set(fields.phones));
        setPickedWebsites(new Set(fields.websites));
        setTextDraft(fields.rawText.trim());
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePick = (set: Set<string>, setter: (s: Set<string>) => void) =>
    (value: string) => {
      const next = new Set(set);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      setter(next);
    };

  const onSave = async () => {
    if (!extracted) return;
    const lines: string[] = [];
    const stamp = new Date().toLocaleDateString("it-IT");
    lines.push(`--- Biglietto da visita (${stamp}) ---`);
    if (pickedEmails.size > 0)
      lines.push(`Email: ${Array.from(pickedEmails).join(", ")}`);
    if (pickedPhones.size > 0)
      lines.push(`Tel: ${Array.from(pickedPhones).join(", ")}`);
    if (pickedWebsites.size > 0)
      lines.push(`Web: ${Array.from(pickedWebsites).join(", ")}`);
    if (includeRawText && textDraft.trim()) {
      lines.push("");
      lines.push(textDraft.trim());
    }
    const block = lines.join("\n");

    const prevNotes = visits[exhibitorId]?.notes ?? "";
    const merged = prevNotes ? `${prevNotes.trim()}\n\n${block}` : block;
    await updateVisit(exhibitorId, { notes: merged });
    onClose();
  };

  const isLoading = !extracted && !error;
  const pct = Math.round(progress.progress * 100);
  const statusLabel = humanizeStatus(progress.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bizcard-title"
    >
      <button
        type="button"
        aria-label="Chiudi"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-neutral-950 rounded-t-2xl sm:rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-neutral-950 z-10 px-4 py-3 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <h2 id="bizcard-title" className="text-lg font-bold">
            Scan biglietto
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap min-w-tap px-2 text-sm text-neutral-500"
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Biglietto"
              className="w-full max-h-48 object-contain rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900"
            />
          )}

          {error && (
            <div role="alert" className="text-sm rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-2">
              Errore OCR: {error}
            </div>
          )}

          {isLoading && !error && (
            <div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                {statusLabel}… {pct}%
              </div>
              <div className="h-2 rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${Math.max(pct, 5)}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Al primo utilizzo viene scaricato il modello linguistico
                italiano (~10MB). Le scansioni successive partono in 1-2 secondi.
              </p>
            </div>
          )}

          {extracted && (
            <>
              {extracted.emails.length === 0 &&
              extracted.phones.length === 0 &&
              extracted.websites.length === 0 ? (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Non ho riconosciuto contatti automaticamente. Puoi comunque
                  modificare il testo qui sotto e salvarlo nelle note.
                </p>
              ) : (
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Spunta i contatti riconosciuti che vuoi aggiungere alle note.
                </p>
              )}

              <Section title="Email">
                {extracted.emails.length === 0 ? (
                  <Empty />
                ) : (
                  extracted.emails.map((e) => (
                    <CheckRow
                      key={e}
                      label={e}
                      checked={pickedEmails.has(e)}
                      onToggle={() =>
                        togglePick(pickedEmails, setPickedEmails)(e)
                      }
                    />
                  ))
                )}
              </Section>

              <Section title="Telefono">
                {extracted.phones.length === 0 ? (
                  <Empty />
                ) : (
                  extracted.phones.map((p) => (
                    <CheckRow
                      key={p}
                      label={p}
                      checked={pickedPhones.has(p)}
                      onToggle={() =>
                        togglePick(pickedPhones, setPickedPhones)(p)
                      }
                    />
                  ))
                )}
              </Section>

              <Section title="Web">
                {extracted.websites.length === 0 ? (
                  <Empty />
                ) : (
                  extracted.websites.map((w) => (
                    <CheckRow
                      key={w}
                      label={w}
                      checked={pickedWebsites.has(w)}
                      onToggle={() =>
                        togglePick(pickedWebsites, setPickedWebsites)(w)
                      }
                    />
                  ))
                )}
              </Section>

              <details className="text-sm">
                <summary className="cursor-pointer min-h-tap py-1 text-neutral-700 dark:text-neutral-300">
                  Testo completo riconosciuto (modifica e includi se serve)
                </summary>
                <label className="flex items-center gap-2 select-none mt-1 mb-1">
                  <input
                    type="checkbox"
                    checked={includeRawText}
                    onChange={(e) => setIncludeRawText(e.target.checked)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  <span className="text-xs">Aggiungi anche il testo libero alle note</span>
                </label>
                <textarea
                  value={textDraft}
                  onChange={(e) => setTextDraft(e.target.value)}
                  rows={6}
                  className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-xs font-mono"
                />
              </details>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 p-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-tap rounded-lg border border-neutral-300 dark:border-neutral-700 font-medium text-sm"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={!extracted}
            onClick={() => void onSave()}
            className="flex-[1.5] min-h-tap rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm disabled:opacity-50"
          >
            Aggiungi alle note
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm select-none cursor-pointer min-h-tap">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-5 w-5 accent-brand-500"
      />
      <span className="break-all">{label}</span>
    </label>
  );
}

function Empty() {
  return (
    <div className="text-xs text-neutral-500 italic">— nessuno riconosciuto</div>
  );
}

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function humanizeStatus(s: string): string {
  switch (s) {
    case "loading tesseract core":
    case "loading core":
      return "Carico il motore OCR";
    case "initializing tesseract":
    case "initializing api":
      return "Inizializzo";
    case "loading language traineddata":
    case "loading language traineddata (from cache)":
      return "Carico il modello linguistico";
    case "initialized api":
    case "initialized tesseract":
      return "Pronto";
    case "recognizing text":
      return "Riconosco il testo";
    default:
      return s;
  }
}
