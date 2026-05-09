import { useEffect, useState } from "react";
import { getMediaBlob } from "../data/media";

/**
 * Carica il blob da IndexedDB e restituisce un object URL utilizzabile come
 * src di <img>/<audio>. Revoca l'URL quando il componente smonta o l'id
 * cambia, così non accumuliamo memoria. Ritorna null finché il blob non è
 * disponibile.
 */
export function useMediaBlobUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setUrl(null);
    getMediaBlob(id).then((blob) => {
      if (cancelled || !blob) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);

  return url;
}
