import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "../state";
import { useMediaBlobUrl } from "../hooks/useMediaBlobUrl";
import type { MediaItem } from "../data/media";

interface Props {
  exhibitorId: string;
}

export function MediaSection({ exhibitorId }: Props) {
  const { media, addPhoto, addAudio, removeMedia } = useAppState();

  const items = useMemo(
    () =>
      media
        .filter((m) => m.exhibitorId === exhibitorId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [media, exhibitorId],
  );
  const photos = items.filter((m) => m.kind === "photo");
  const audios = items.filter((m) => m.kind === "audio");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"photo" | "audio" | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase text-neutral-500">Foto e audio</span>
        {items.length > 0 && (
          <span className="text-xs text-neutral-500">
            {photos.length > 0 && `${photos.length} foto`}
            {photos.length > 0 && audios.length > 0 && " · "}
            {audios.length > 0 && `${audios.length} audio`}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-2">
        <PhotoCaptureButton
          exhibitorId={exhibitorId}
          onAdd={async (file) => {
            setError(null);
            setBusy("photo");
            try {
              await addPhoto(exhibitorId, file);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          }}
          busy={busy === "photo"}
        />
        <AudioCaptureButton
          onAdd={async (blob, durationMs) => {
            setError(null);
            setBusy("audio");
            try {
              await addAudio(exhibitorId, blob, durationMs);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          }}
          onError={(msg) => setError(msg)}
        />
      </div>

      {error && (
        <div role="alert" className="mb-2 text-xs rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 px-2 py-1">
          {error}
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {photos.map((p) => (
            <PhotoTile key={p.id} item={p} onDelete={() => void removeMedia(p.id)} />
          ))}
        </div>
      )}

      {audios.length > 0 && (
        <ul className="space-y-1.5">
          {audios.map((a) => (
            <AudioRow key={a.id} item={a} onDelete={() => void removeMedia(a.id)} />
          ))}
        </ul>
      )}

      {items.length === 0 && (
        <p className="text-xs text-neutral-500">
          Scatta una foto al banco, ai prodotti o al biglietto da visita;
          oppure registra una nota vocale rapida (mani libere).
        </p>
      )}
    </div>
  );
}

function PhotoCaptureButton({
  exhibitorId,
  onAdd,
  busy,
}: {
  exhibitorId: string;
  onAdd: (file: File) => Promise<void>;
  busy: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
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
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await onAdd(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="min-h-tap px-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50"
        aria-label={`Aggiungi foto a ${exhibitorId}`}
      >
        <span aria-hidden="true">📷</span>
        {busy ? "Salvo..." : "Foto"}
      </button>
    </>
  );
}

function AudioCaptureButton({
  onAdd,
  onError,
}: {
  onAdd: (blob: Blob, durationMs: number) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  const cleanup = () => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsed(0);
  };

  // Pulisci se il componente viene smontato a registrazione in corso (es.
  // l'utente chiude l'espansione della card). Senza questo il microfono
  // resterebbe acceso.
  useEffect(() => {
    return () => {
      if (recRef.current && recRef.current.state !== "inactive") {
        try {
          recRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("Registrazione audio non supportata dal browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Lascio il default del browser per il mime — opus/webm su Chrome,
      // mp4/aac su Safari recente.
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const mime = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const duration = Date.now() - startedAtRef.current;
        cleanup();
        if (blob.size > 0) {
          await onAdd(blob, duration);
        }
      };
      startedAtRef.current = Date.now();
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 250);
    } catch (e) {
      cleanup();
      onError(
        e instanceof Error
          ? `Microfono non accessibile: ${e.message}`
          : "Microfono non accessibile",
      );
    }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
  };

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      aria-pressed={recording}
      className={`min-h-tap px-3 rounded-full border text-sm font-medium inline-flex items-center gap-1 ${
        recording
          ? "bg-red-500 border-red-500 text-white animate-pulse"
          : "border-neutral-300 dark:border-neutral-700"
      }`}
    >
      <span aria-hidden="true">{recording ? "⏹" : "🎤"}</span>
      {recording ? `Stop · ${formatDuration(elapsed)}` : "Audio"}
    </button>
  );
}

function PhotoTile({
  item,
  onDelete,
}: {
  item: MediaItem;
  onDelete: () => void;
}) {
  const url = useMediaBlobUrl(item.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative aspect-square rounded overflow-hidden bg-neutral-100 dark:bg-neutral-800 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label="Apri foto"
      >
        {url ? (
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
            ...
          </span>
        )}
      </button>
      {open && url && (
        <PhotoLightbox url={url} onClose={() => setOpen(false)} onDelete={onDelete} />
      )}
    </>
  );
}

function PhotoLightbox({
  url,
  onClose,
  onDelete,
}: {
  url: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between p-3 text-white">
        <button
          type="button"
          onClick={onClose}
          className="min-h-tap min-w-tap px-3 rounded-full border border-white/40 text-sm font-medium"
        >
          Chiudi
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Eliminare questa foto?")) {
              onDelete();
              onClose();
            }
          }}
          className="min-h-tap min-w-tap px-3 rounded-full border border-red-400 text-red-200 text-sm font-medium"
        >
          Elimina
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3">
        <img
          src={url}
          alt=""
          className="max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  );
}

function AudioRow({
  item,
  onDelete,
}: {
  item: MediaItem;
  onDelete: () => void;
}) {
  const url = useMediaBlobUrl(item.id);
  return (
    <li className="flex items-center gap-2">
      {url ? (
        <audio src={url} controls preload="metadata" className="flex-1 h-10" />
      ) : (
        <span className="flex-1 text-xs text-neutral-500">caricamento…</span>
      )}
      <span className="text-[10px] text-neutral-500 shrink-0 tabular-nums">
        {item.durationMs ? formatDuration(item.durationMs) : ""}
      </span>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Eliminare questa nota audio?")) onDelete();
        }}
        className="min-h-tap min-w-tap px-2 text-neutral-500 hover:text-red-500"
        aria-label="Elimina audio"
        title="Elimina audio"
      >
        ✕
      </button>
    </li>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
