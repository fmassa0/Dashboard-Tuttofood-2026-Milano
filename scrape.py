#!/usr/bin/env python3
"""
Scraper Espositori Tuttofood 2026 - catalogo.fiereparma.it

Estrae nome, indirizzo, contatti, padiglione/stand, p.iva e categorie
di tutti gli espositori del catalogo Tuttofood 2026 di Fiere di Parma.

La lista completa degli espositori NON è visibile nei link <a>: si trova
dentro la <select id="select2-search-ragsoc"> (optgroup "Espositori"),
con data-url="/?p=NNNNN&f=tuttofood-2026" che redirige alla scheda canonica.

Uso:
    pip install -r requirements.txt
    python scrape.py

Output:
    - espositori_tuttofood_2026.csv  (incrementale, append)
    - progress.json                  (per resume in caso di crash)

L'Excel finale con foglio Statistiche è prodotto da build_excel.py.
"""

import csv
import html as html_lib
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
EVENT_FILTER = "tuttofood-2026"

OUT_DIR = Path(__file__).parent
OUT_CSV = OUT_DIR / "espositori_tuttofood_2026.csv"
PROGRESS_FILE = OUT_DIR / "progress.json"

DELAY_SECONDS = 0.5
TIMEOUT = 30
MAX_RETRIES = 3
PROGRESS_EVERY = 200  # log ogni N righe

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
}

FIELDNAMES = [
    "nome", "url", "url_canonical",
    "indirizzo", "cap", "citta", "provincia", "regione", "paese",
    "telefono", "email", "sito_web",
    "padiglione", "stand", "coespositore", "espositore_principale",
    "partita_iva",
    "marchi", "categorie", "descrizione",
]

# ========== MAPPA PROVINCIA -> REGIONE ==========
PROVINCIA_REGIONE = {
    # Abruzzo
    "AQ": "Abruzzo", "CH": "Abruzzo", "PE": "Abruzzo", "TE": "Abruzzo",
    # Basilicata
    "MT": "Basilicata", "PZ": "Basilicata",
    # Calabria
    "CS": "Calabria", "CZ": "Calabria", "KR": "Calabria", "RC": "Calabria", "VV": "Calabria",
    # Campania
    "AV": "Campania", "BN": "Campania", "CE": "Campania", "NA": "Campania", "SA": "Campania",
    # Emilia-Romagna
    "BO": "Emilia-Romagna", "FC": "Emilia-Romagna", "FE": "Emilia-Romagna",
    "MO": "Emilia-Romagna", "PC": "Emilia-Romagna", "PR": "Emilia-Romagna",
    "RA": "Emilia-Romagna", "RE": "Emilia-Romagna", "RN": "Emilia-Romagna",
    # Friuli-Venezia Giulia
    "GO": "Friuli-Venezia Giulia", "PN": "Friuli-Venezia Giulia",
    "TS": "Friuli-Venezia Giulia", "UD": "Friuli-Venezia Giulia",
    # Lazio
    "FR": "Lazio", "LT": "Lazio", "RI": "Lazio", "RM": "Lazio", "VT": "Lazio",
    # Liguria
    "GE": "Liguria", "IM": "Liguria", "SP": "Liguria", "SV": "Liguria",
    # Lombardia
    "BG": "Lombardia", "BS": "Lombardia", "CO": "Lombardia", "CR": "Lombardia",
    "LC": "Lombardia", "LO": "Lombardia", "MB": "Lombardia", "MI": "Lombardia",
    "MN": "Lombardia", "PV": "Lombardia", "SO": "Lombardia", "VA": "Lombardia",
    # Marche
    "AN": "Marche", "AP": "Marche", "FM": "Marche", "MC": "Marche", "PU": "Marche",
    # Molise
    "CB": "Molise", "IS": "Molise",
    # Piemonte
    "AL": "Piemonte", "AT": "Piemonte", "BI": "Piemonte", "CN": "Piemonte",
    "NO": "Piemonte", "TO": "Piemonte", "VB": "Piemonte", "VC": "Piemonte",
    # Puglia
    "BA": "Puglia", "BR": "Puglia", "BT": "Puglia", "FG": "Puglia",
    "LE": "Puglia", "TA": "Puglia",
    # Sardegna
    "CA": "Sardegna", "NU": "Sardegna", "OR": "Sardegna", "SS": "Sardegna", "SU": "Sardegna",
    # Sicilia
    "AG": "Sicilia", "CL": "Sicilia", "CT": "Sicilia", "EN": "Sicilia",
    "ME": "Sicilia", "PA": "Sicilia", "RG": "Sicilia", "SR": "Sicilia", "TP": "Sicilia",
    # Toscana
    "AR": "Toscana", "FI": "Toscana", "GR": "Toscana", "LI": "Toscana",
    "LU": "Toscana", "MS": "Toscana", "PI": "Toscana", "PO": "Toscana",
    "PT": "Toscana", "SI": "Toscana",
    # Trentino-Alto Adige
    "BZ": "Trentino-Alto Adige", "TN": "Trentino-Alto Adige",
    # Umbria
    "PG": "Umbria", "TR": "Umbria",
    # Valle d'Aosta
    "AO": "Valle d'Aosta",
    # Veneto
    "BL": "Veneto", "PD": "Veneto", "RO": "Veneto", "TV": "Veneto",
    "VE": "Veneto", "VI": "Veneto", "VR": "Veneto",
}


def provincia_to_regione(prov: str, paese: str) -> str:
    """Mappa la sigla provincia alla regione italiana. Vuoto se estero."""
    if not prov:
        return ""
    p = prov.strip().upper()
    if p in PROVINCIA_REGIONE:
        # Validazione: la regione ha senso solo se il paese è Italia o vuoto
        if paese and "ital" not in paese.lower() and "italy" not in paese.lower():
            return ""
        return PROVINCIA_REGIONE[p]
    return ""


# ========== UTILITY ==========

def fetch(session: requests.Session, url: str) -> tuple[str, str]:
    """GET con retry esponenziale. Ritorna (html, url_finale_dopo_redirect)."""
    last_exc = None
    for attempt in range(MAX_RETRIES):
        try:
            r = session.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
            r.raise_for_status()
            return r.text, r.url
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

# Pattern: <option data-url="/?p=NNN&f=tuttofood-2026">NOME ENTITÀ</option>
OPTION_RE = re.compile(
    r'<option\s+data-url="(/\?p=\d+&f=tuttofood-2026)"[^>]*>([^<]+)</option>',
    re.IGNORECASE,
)
# Per isolare il blocco "Espositori" specifico (escludendo Marchi/Merceologie)
ESPOSITORI_BLOCK_RE = re.compile(
    r'<optgroup label="Espositori">(.*?)</optgroup>',
    re.IGNORECASE | re.DOTALL,
)


def get_exhibitor_links(session: requests.Session) -> list[tuple[str, str]]:
    """
    Estrae (nome, url) di TUTTI gli espositori dalla <select id="select2-search-ragsoc">.
    Deduplica per p_id.
    """
    print(f"[lista] Scarico {LIST_URL}", flush=True)
    list_html, _ = fetch(session, LIST_URL)

    seen: dict[str, tuple[str, str]] = {}
    for blk in ESPOSITORI_BLOCK_RE.findall(list_html):
        for path, raw_name in OPTION_RE.findall(blk):
            url = urljoin(BASE_URL, path)
            name = html_lib.unescape(raw_name).strip()
            if not name:
                continue
            # Estrai p_id come chiave dedup
            m = re.search(r"\?p=(\d+)", path)
            pid = m.group(1) if m else path
            if pid not in seen:
                seen[pid] = (name, url)

    return sorted(seen.values(), key=lambda x: x[0])


# ========== PARSING SCHEDA ==========

LOC_RE = re.compile(
    r"(\d{4,5})\s+"
    r"([A-ZÀ-Ýa-zà-ÿ][\w\.\'\s]+?)\s*-\s*"
    r"\(([A-Z]{0,3})\)\s*-\s*"
    r"([A-ZÀ-Ý][A-ZÀ-Ýa-zà-ÿ\s\-\.]+?)"
    r"(?=\s*(?:Tel|Phone|E[-\s]?mail|@|\d{2,}|$|\.|·|•|\n))",
    re.IGNORECASE | re.UNICODE,
)

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

# Padiglione N - Stand XX (es. "Padiglione 10 - Stand K23")
PAD_STAND_RE = re.compile(
    r"Padiglion[ei]\s*[:\-]?\s*([A-Z0-9]+)\s*[-\s]+\s*Stand\s*[:\-]?\s*([A-Z0-9]+)",
    re.IGNORECASE,
)

# P.IVA: il portale Fiere di Parma non espone questo campo nelle schede, resta vuoto.

COESPOSITORE_RE = re.compile(r"\bCo[\-\s]?esposit", re.IGNORECASE)


def _box_body_after(soup, title_re):
    """Ritorna il box-body subito dopo un <h3 class='box-title'> che matcha la regex."""
    for h in soup.find_all("h3", class_="box-title"):
        if title_re.search(h.get_text(strip=True)):
            box = h.find_parent(class_="box")
            if box:
                return box.find(class_="box-body")
    return None


def _label_value(box_body, label_re):
    """Dentro un box-body, trova il <strong>label</strong> e il <p> che lo segue."""
    if box_body is None:
        return None
    for st in box_body.find_all("strong"):
        if label_re.search(st.get_text(" ", strip=True)):
            p = st.find_next_sibling("p")
            if p:
                return p
            # a volte è il successivo a livello del parent
            par = st.parent
            if par:
                nxt = st.find_next("p")
                if nxt:
                    return nxt
    return None


def parse_exhibitor(html: str, fallback_name: str, url: str, url_canonical: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    data = {k: "" for k in FIELDNAMES}
    data["url"] = url
    data["url_canonical"] = url_canonical
    data["nome"] = fallback_name

    # --- Header: nome + padiglione/stand + (co-espositore di X) ---
    header = soup.find("section", class_="content-header")
    if header:
        h1 = header.find("h1")
        if h1:
            data["nome"] = h1.get_text(strip=True)
        h3 = header.find("h3")
        if h3:
            pad_match = PAD_STAND_RE.search(h3.get_text(" ", strip=True))
            if pad_match:
                data["padiglione"] = pad_match.group(1).strip()
                data["stand"] = pad_match.group(2).strip()
        h4 = header.find("h4")
        if h4 and COESPOSITORE_RE.search(h4.get_text(" ", strip=True)):
            data["coespositore"] = "1"
            a_padre = h4.find("a")
            if a_padre:
                data["espositore_principale"] = a_padre.get_text(" ", strip=True)

    # --- Descrizione ---
    pres = soup.find(class_="wrap-presentazione")
    if pres:
        desc = pres.get_text(" ", strip=True)
        if desc:
            data["descrizione"] = desc[:1500]

    # --- Box "Contatti" ---
    contatti = _box_body_after(soup, re.compile(r"^Contatti$", re.I))
    if contatti:
        # Indirizzo
        p_ind = _label_value(contatti, re.compile(r"Indirizzo", re.I))
        if p_ind:
            addr_text = p_ind.get_text(" ", strip=True)
            m = LOC_RE.search(addr_text)
            if m:
                data["cap"] = m.group(1).strip()
                data["citta"] = m.group(2).strip().rstrip(",")
                data["provincia"] = m.group(3).strip()
                data["paese"] = m.group(4).strip().rstrip(" .,")
                before = addr_text[:m.start()].rstrip(" -,")
                km = None
                for x in ADDR_KEYWORDS.finditer(before):
                    km = x
                if km:
                    data["indirizzo"] = before[km.start():].strip(" ,-")
                else:
                    data["indirizzo"] = before.strip(" -,")[-120:]
            else:
                # Estero senza pattern: salva l'intera riga
                data["indirizzo"] = addr_text[:200]

        # Telefono: cerca tel:
        tel_a = contatti.find("a", href=re.compile(r"^tel:", re.I))
        if tel_a:
            data["telefono"] = tel_a.get_text(strip=True) or tel_a["href"][4:]
        else:
            p_tel = _label_value(contatti, re.compile(r"Telefono|Phone", re.I))
            if p_tel:
                txt = p_tel.get_text(" ", strip=True)
                m_tel = re.search(r"(\+?[\d][\d\s\-/().]{5,20}\d)", txt)
                if m_tel:
                    digits = re.sub(r"\D", "", m_tel.group(1))
                    if 7 <= len(digits) <= 16:
                        data["telefono"] = m_tel.group(1).strip()

        # Email: cerca mailto:
        em_a = contatti.find("a", href=re.compile(r"^mailto:", re.I))
        if em_a:
            email = em_a.get_text(strip=True) or em_a["href"][7:]
            data["email"] = email.split("?")[0]
        else:
            em_match = EMAIL_RE.search(contatti.get_text(" ", strip=True))
            if em_match:
                data["email"] = em_match.group(0)

        # Sito web: link non social/tracking nel box Contatti
        for a in contatti.find_all("a", href=True):
            href = a["href"]
            if not href.startswith(("http://", "https://")):
                continue
            host = urlparse(href).netloc.lower()
            if any(x in host for x in (
                "fiereparma.it", "googletagmanager", "google.com",
                "facebook.com", "instagram.com", "linkedin.com",
                "twitter.com", "x.com", "youtube.com", "wa.me", "whatsapp",
            )):
                continue
            data["sito_web"] = href
            break

    data["regione"] = provincia_to_regione(data["provincia"], data["paese"])

    # --- Box "Marchi" ---
    marchi_box = _box_body_after(soup, re.compile(r"^Marchi$", re.I))
    if marchi_box:
        marchi = [a.get_text(" ", strip=True) for a in marchi_box.find_all("a")]
        marchi = [m for m in marchi if m]
        if marchi:
            data["marchi"] = " | ".join(marchi)[:500]

    # --- Box "Merceologie" ---
    merc_box = _box_body_after(soup, re.compile(r"^Merceologie$", re.I))
    if merc_box:
        cats = [s.get_text(" ", strip=True) for s in merc_box.find_all(["span", "a"])]
        cats = [c for c in cats if c and len(c) > 1]
        # dedup mantenendo l'ordine
        seen = set()
        uniq = []
        for c in cats:
            if c not in seen:
                seen.add(c)
                uniq.append(c)
        if uniq:
            data["categorie"] = " | ".join(uniq)[:800]

    return data


# ========== MAIN ==========

def main():
    progress = load_progress()
    session = requests.Session()

    links = get_exhibitor_links(session)
    print(f"[lista] Trovati {len(links)} espositori unici", flush=True)

    file_exists = OUT_CSV.exists() and OUT_CSV.stat().st_size > 0
    done_count = sum(1 for v in progress.values() if v is True)
    print(f"   Già processati: {done_count}", flush=True)

    new_count = 0
    err_count = 0

    with OUT_CSV.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()

        for i, (name, url) in enumerate(links, 1):
            if progress.get(url) is True:
                continue
            try:
                html_text, final_url = fetch(session, url)
                row = parse_exhibitor(html_text, name, url, final_url)
                writer.writerow(row)
                f.flush()
                progress[url] = True
                new_count += 1
            except Exception as e:
                progress[url] = f"ERROR: {e}"
                err_count += 1

            if i % PROGRESS_EVERY == 0:
                save_progress(progress)
                print(
                    f"[{i:>4}/{len(links)}] processed (+{new_count} new, {err_count} errors)",
                    flush=True,
                )

            time.sleep(DELAY_SECONDS)

    save_progress(progress)
    print(
        f"\n[done] CSV salvato: {OUT_CSV}  (+{new_count} nuove righe, {err_count} errori)",
        flush=True,
    )
    print("[done] Ora esegui: python build_excel.py", flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[stop] Interrotto. Riavvia per riprendere da dove eri.")
        sys.exit(130)
