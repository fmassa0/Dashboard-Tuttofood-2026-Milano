// Wrapper attorno a tesseract.js. Esporto solo le funzioni che mi servono e
// le importo via dynamic import dal componente, così la libreria (~5MB +
// language pack ~10MB scaricato dal CDN al primo uso) non finisce nel bundle
// principale.

export interface OcrProgress {
  status: string;
  progress: number; // 0..1
}

export interface ExtractedFields {
  emails: string[];
  phones: string[];
  websites: string[];
  rawText: string;
}

/**
 * Riconosce il testo da una foto del biglietto da visita. Lingue: italiano +
 * inglese (la maggior parte dei bizcard ha entrambe).
 *
 * Cache language pack: tesseract.js scarica i .traineddata da jsdelivr al
 * primo utilizzo (~10MB l'uno) e li tiene in IndexedDB. Le run successive
 * partono in 1-2 secondi.
 */
export async function runOcr(
  source: File | Blob,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker(["ita", "eng"], 1, {
    logger: (m) => {
      if (onProgress) {
        onProgress({ status: m.status, progress: m.progress ?? 0 });
      }
    },
  });
  try {
    const result = await worker.recognize(source);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Estrae email/telefoni/url dal testo OCR. Le regex sono volutamente larghe
 * (l'OCR sbaglia spesso un carattere); l'utente vede sempre la lista e può
 * deselezionare i falsi positivi prima di salvare.
 */
export function parseFields(text: string): ExtractedFields {
  const emails = uniq(
    Array.from(text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)).map((m) =>
      m[0].toLowerCase(),
    ),
  );

  // Telefoni: +39, 0..., 39..., con/senza spazi/punti/trattini. Almeno 8 cifre
  // significative una volta ripuliti.
  const phoneCandidates = Array.from(
    text.matchAll(/(\+?\d[\d\s.\-/]{6,}\d)/g),
  ).map((m) => m[0].trim());
  const phones = uniq(
    phoneCandidates
      .map((p) => p.replace(/[\s.\-/]+/g, " ").trim())
      .filter((p) => p.replace(/\D/g, "").length >= 8),
  );

  // Website: include www., http(s), e domini puri (es. example.it)
  const websites = uniq(
    Array.from(
      text.matchAll(
        /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})+(?:\/[^\s]*)?/gi,
      ),
    )
      .map((m) => m[0])
      .filter((u) => !u.includes("@") && /\.[a-z]{2,}/i.test(u)),
  );

  return { emails, phones, websites, rawText: text };
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
