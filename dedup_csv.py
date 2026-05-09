#!/usr/bin/env python3
"""
Deduplica espositori_tuttofood_2026.csv per url_canonical.

Mantiene la prima occorrenza di ciascun url_canonical e sostituisce il file in-place.
Crea un backup .bak della versione duplicata.
"""
import csv
import shutil
from pathlib import Path

CSV_PATH = Path(__file__).parent / "espositori_tuttofood_2026.csv"
BAK_PATH = CSV_PATH.with_suffix(".csv.bak")


def main():
    if not CSV_PATH.exists():
        raise SystemExit(f"CSV non trovato: {CSV_PATH}")

    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    seen = set()
    deduped = []
    for r in rows:
        key = (r.get("url_canonical") or r.get("url") or r.get("nome", "")).strip()
        if key and key not in seen:
            seen.add(key)
            deduped.append(r)

    print(f"Prima: {len(rows)} record")
    print(f"Dopo:  {len(deduped)} record")
    print(f"Rimossi: {len(rows) - len(deduped)} duplicati")

    shutil.copyfile(CSV_PATH, BAK_PATH)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in deduped:
            w.writerow(r)
    print(f"OK. Backup duplicati: {BAK_PATH.name}")


if __name__ == "__main__":
    main()
