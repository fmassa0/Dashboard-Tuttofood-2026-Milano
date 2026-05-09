#!/usr/bin/env python3
"""
Scraper Espositori Tuttofood 2026 - catalogo.fiereparma.it

Estrae nome, indirizzo, contatti e caratteristiche di tutti gli espositori
del catalogo Tuttofood 2026 di Fiere di Parma.

Uso:
    pip install requests beautifulsoup4 lxml openpyxl
    python scrape_tuttofood_2026.py

Output:
    - espositori_tuttofood_2026.csv  (incrementale, append)
    - espositori_tuttofood_2026.xlsx (rigenerato a fine corsa)
    - progress.json                  (per resume in caso di crash)

Note:
    - Rate limit: 0.5s tra le richieste (modificabile via DELAY)
    - Resume automatico: se interrompi e riavvii, riprende da dove era
    - User-Agent realistico per evitare blocchi
"""

import csv
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# ========== CONFIGURAZIONE ==========
BASE_URL = "https://catalogo.fiereparma.it"
LIST_URL = f"{BASE_URL}/manifestazione/tuttofood-2026/"
EVENT_FILTER = "tuttofood-2026"  # parametro ?f= della scheda

OUT_DIR = Path(__file__).parent
OUT_CSV = OUT_DIR / "espositori_tuttofood_2026.csv"
OUT_XLSX = OUT_DIR / "espositori_tuttofood_2026.xlsx"
PROGRESS_FILE = OUT_DIR / "progress.json"

DELAY_SECONDS = 0.5     # pausa tra le richieste (sii gentile col server)
TIMEOUT = 30
MAX_RETRIES = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
}

FIELDNAMES = [
    "nome", "url", "indirizzo", "cap", "citta", "provincia", "paese",
    "telefono", "email", "sito_web", "categorie", "descrizione",
    "padiglione_stand",
]

# ========== UTILITY ==========

def fetch(session: requests.Session, url: str) -> str:
    """GET con retry esponenziale."""
    last_exc = None
    for attempt in range(MAX_RETRIES):
        try:
            r = session.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            return r.text
        except requests.RequestException as e:
            last_exc = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"Fallito dopo {MAX_RETRIES} tentativi: {url}") from last_exc


def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        try:
            return json.loads(PROGRESS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def save_progress(progress: dict):
    PROGRESS_FILE.write_text(
        json.dumps(progress, ensure_ascii=False), encoding="utf-8"
    )


# ========== ESTRAZIONE LISTA ==========

def get_exhibitor_links(session: requests.Session) -> list[tuple[str, str]]:
    """
    Estrae (nome, url_assoluto) di tutti gli espositori dalla pagina lista.
    Deduplica per URL.
    """
    print(f"📥 Scarico la lista da {LIST_URL}")
    html = fetch(session, LIST_URL)
    soup = BeautifulSoup(html, "lxml")

    seen = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Le schede hanno path tipo /azienda/<slug>/
        if "/azienda/" not in href:
            continue
        url = urljoin(BASE_URL, href)
        # Forza il filtro evento
        if "?" not in url:
            url = f"{url}?f={EVENT_FILTER}"
        elif "f=" not in url:
            url = f"{url}&f={EVENT_FILTER}"
        # Normalizza: rimuovi fragment
        url = url.split("#")[0]

        name = a.get_text(strip=True)
        # Salta se è un nav/breadcrumb (no nome significativo)
        if not name or len(name) < 2:
            continue

        # Dedup per path (slug)
        path = urlparse(url).path
        if path not in seen:
            seen[path] = (name, url)

    return sorted(seen.values(), key=lambda x: x[0])


# ========== PARSING SCHEDA ==========

# Ancora forte: "CAP CITTA - (PR) - PAESE" - l'indirizzo lo estraiamo a parte
LOC_RE = re.compile(
    r"(\d{4,5})\s+"                                   # CAP
    r"([A-ZÀ-Ýa-zà-ÿ][\w\.\'\s]+?)\s*-\s*"           # città
    r"\(([A-Z]{0,3})\)\s*-\s*"                        # provincia (vuota = estero)
    r"([A-ZÀ-Ý][A-ZÀ-Ýa-zà-ÿ\s\-\.]+?)"              # paese
    r"(?=\s*(?:Tel|Phone|E[-\s]?mail|@|\d{2,}|$|\.|·|•|\n))",
    re.IGNORECASE | re.UNICODE,
)

# Keywords che marcano l'inizio di un indirizzo (multilingua)
ADDR_KEYWORDS = re.compile(
    r"\b(?:VIA|VIALE|V\.LE|PIAZZA|P\.ZZA|P\.LE|CORSO|C\.SO|VICOLO|LARGO|"
    r"STRADA|S\.S\.|CONTRADA|C\.DA|LOC\.|LOCALITA'|FRAZ\.|FRAZIONE|"
    r"BORGO|REGIONE|RIONE|TRAVERSA|"
    r"CALLE|CARRER|AVDA|AVENIDA|PASEO|RUA|"
    r"STREET|ROAD|AVENUE|AV\.|PLACE|LANE|DRIVE|WAY|"
    r"STRASSE|STR\.|GASSE|PLATZ|WEG|"
    r"EDT|UL\.|PL\.|RUE|BD\.|BOULEVARD)\b",
    re.IGNORECASE,
)

EMAIL_RE = re.compile(r"[\w.\-+]+@[\w\-]+\.[\w.\-]+")


def parse_exhibitor(html: str, fallback_name: str, url: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    data = {k: "" for k in FIELDNAMES}
    data["url"] = url
    data["nome"] = fallback_name

    # --- Nome: cerca h1/h2/h3 nel main, escludendo il logo ---
    main = soup.find("main") or soup.find(class_=re.compile("content|main", re.I)) or soup
    for tag in main.find_all(["h1", "h2", "h3"]):
        txt = tag.get_text(strip=True)
        if txt and txt.upper() not in ("ESPOSITORI", "PREFERITI", "CATALOGO ESPOSITORI"):
            data["nome"] = txt
            break

    # --- Testo completo della scheda per regex ---
    body_text = main.get_text(" ", strip=True)

    # --- Indirizzo: cerca per ogni elemento <p>/<div> il pattern CAP+città+(prov)+paese ---
    addr_node = None
    loc_match = None
    for el in main.find_all(["p", "div", "span", "li"]):
        txt = el.get_text(" ", strip=True)
        if not txt or len(txt) > 400:  # nodo troppo grande = non è la riga indirizzo
            continue
        m = LOC_RE.search(txt)
        if m:
            addr_node = el
            loc_match = m
            addr_text = txt
            break

    if loc_match:
        data["cap"]       = loc_match.group(1).strip()
        data["citta"]     = loc_match.group(2).strip().rstrip(",")
        data["provincia"] = loc_match.group(3).strip()
        data["paese"]     = loc_match.group(4).strip().rstrip(" .,")

        # L'indirizzo è il pezzo PRIMA del CAP nello stesso nodo
        before = addr_text[:loc_match.start()].rstrip(" -,")
        # Cerca dall'ultima keyword di indirizzo
        keyword_match = None
        for km in ADDR_KEYWORDS.finditer(before):
            keyword_match = km
        if keyword_match:
            indirizzo = before[keyword_match.start():].strip(" ,-")
        else:
            # fallback: prendi solo l'ultimo segmento dopo "-" o gli ultimi 80 char
            parts = before.rsplit(" - ", 1)
            indirizzo = parts[-1].strip(" ,-")[-120:]
        data["indirizzo"] = indirizzo

    # Email
    em = EMAIL_RE.search(body_text)
    if em:
        data["email"] = em.group(0)

    # Telefono: due strategie - con keyword "Tel/Phone" o con prefisso internazionale
    tel = ""
    m_tel = re.search(
        r"(?:Tel\.?|Telefono|Phone|Fon)[\s\.:]*(\+?[\d][\d\s\-/().]{5,20}\d)",
        body_text, re.IGNORECASE,
    )
    if not m_tel:
        m_tel = re.search(
            r"\b((?:\+|00)\d{2,3}[\s\-]?\d[\d\s\-/().]{5,18}\d)",
            body_text,
        )
    if m_tel:
        candidate = m_tel.group(1).strip(" -.,/")
        digits_only = re.sub(r"\D", "", candidate)
        if 7 <= len(digits_only) <= 16:
            tel = candidate
    data["telefono"] = tel

    # Sito web: primo link esterno non tracking
    for a in main.find_all("a", href=True):
        href = a["href"]
        if not href.startswith(("http://", "https://")):
            continue
        host = urlparse(href).netloc.lower()
        if any(x in host for x in (
            "fiereparma.it", "googletagmanager", "google.com",
            "facebook.com", "instagram.com", "linkedin.com",
            "twitter.com", "x.com", "youtube.com",
        )):
            continue
        data["sito_web"] = href
        break

    # Categorie merceologiche / prodotti
    cat_block = soup.find(string=re.compile(r"Categori[ae]|Settor[ei]|Prodott", re.I))
    if cat_block and cat_block.parent:
        parent = cat_block.parent
        siblings_text = " ".join(s.get_text(" ", strip=True) for s in parent.find_next_siblings(limit=5))
        data["categorie"] = siblings_text[:500]

    # Padiglione/stand
    pad_match = re.search(r"Padiglion[ei]\s*[:\-]?\s*(\w+)\s*[-\s]+\s*Stand\s*[:\-]?\s*(\w+)", body_text, re.I)
    if pad_match:
        data["padiglione_stand"] = f"Pad. {pad_match.group(1)} - Stand {pad_match.group(2)}"

    # Descrizione: cerca paragrafi lunghi nella main
    descs = []
    for p in main.find_all(["p", "div"]):
        t = p.get_text(" ", strip=True)
        if 80 <= len(t) <= 2000 and "Cookie" not in t and "preferiti" not in t.lower():
            descs.append(t)
            if len(" ".join(descs)) > 500:
                break
    if descs:
        data["descrizione"] = " ".join(descs)[:1500]

    return data


# ========== MAIN ==========

def main():
    progress = load_progress()
    session = requests.Session()

    links = get_exhibitor_links(session)
    print(f"✅ Trovati {len(links)} espositori unici")

    # CSV in append mode
    file_exists = OUT_CSV.exists() and OUT_CSV.stat().st_size > 0
    rows_collected = []

    with OUT_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()

        for i, (name, url) in enumerate(links, 1):
            if progress.get(url):
                continue
            try:
                html = fetch(session, url)
                row = parse_exhibitor(html, name, url)
                writer.writerow(row)
                f.flush()
                rows_collected.append(row)
                progress[url] = True
                print(f"[{i:>4}/{len(links)}] ✓ {row['nome'][:55]:<55} | {row['citta'][:25]}")
            except Exception as e:
                print(f"[{i:>4}/{len(links)}] ✗ {name[:55]:<55} | ERRORE: {e}")
                progress[url] = f"ERROR: {e}"

            if i % 25 == 0:
                save_progress(progress)
            time.sleep(DELAY_SECONDS)

    save_progress(progress)
    print(f"\n💾 CSV salvato: {OUT_CSV}")

    # Conversione in XLSX (opzionale)
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Espositori Tuttofood 2026"
        # rilegge l'intero CSV (per includere righe da run precedenti)
        with OUT_CSV.open(encoding="utf-8") as f:
            reader = csv.reader(f)
            for r in reader:
                ws.append(r)
        # Larghezze colonne
        widths = [40, 70, 40, 8, 25, 6, 15, 20, 35, 40, 40, 60, 25]
        for col, w in enumerate(widths, 1):
            ws.column_dimensions[chr(64 + col) if col <= 26 else f"A{chr(64 + col - 26)}"].width = w
        wb.save(OUT_XLSX)
        print(f"💾 XLSX salvato: {OUT_XLSX}")
    except ImportError:
        print("ℹ️  Installa openpyxl per output Excel: pip install openpyxl")
    except Exception as e:
        print(f"⚠️  XLSX non generato: {e}")

    print("\n🎉 Fatto!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏸  Interrotto. Riavvia per riprendere da dove eri.")
        sys.exit(130)
