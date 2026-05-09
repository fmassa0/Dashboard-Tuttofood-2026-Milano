# Dashboard Tuttofood 2026 — Milano

Toolkit per la fiera Tuttofood 2026:
- **scraper Python** (`scrape.py`) → estrae i ~3000 espositori dal catalogo ufficiale di Fiere di Parma
- **export Excel** (`build_excel.py`) → produce `espositori_tuttofood_2026.xlsx` con foglio Statistiche
- **PWA React** (`pwa/`) → app installabile per consultare gli espositori, segnare visite, prendere note, esportare i propri dati. Funziona offline.

## Scraping

```bash
pip install -r requirements.txt
python scrape.py            # ~25-40 minuti, riprende da progress.json se interrotto
python build_excel.py       # genera espositori_tuttofood_2026.xlsx
```

Output principali:
- `espositori_tuttofood_2026.csv` (2996 righe, 19 colonne)
- `espositori_tuttofood_2026.xlsx` (foglio "Espositori" + "Statistiche")

> Nota: la `partita_iva` non è disponibile sul portale Fiere di Parma (campo presente nello schema ma sempre vuoto).

## PWA

App offline-first per consultare gli espositori durante la fiera, segnare le visite, prendere note, taggare e esportare un xlsx personale.

### Sviluppo locale

```bash
cd pwa
npm install
npm run dev          # http://localhost:5173
npm run build        # genera dist/
npm run preview      # serve dist/ su :4173
```

### Funzionalità
- **Lista**: ricerca full-text (debounced), filtri multi-select per regione/paese/padiglione/categoria/grandezza, sort A→Z / città / non-ancora-visitati, virtual scrolling (react-window) per le ~3000 righe
- **Card espositore**: toggle "Visitato" tap-friendly, note multilinea, tag preset + custom, timestamp
- **Mappa**: planimetria ufficiale Tuttofood + heatmap visite per padiglione (tap → filtra la lista)
- **Dashboard**: visitati / rimanenti / tempo medio / lista "da rivedere" / ultime visite / tag più usati
- **Export**: xlsx solo dei tuoi visitati, oppure xlsx completo, generato in browser con SheetJS
- **PWA**: manifest + Workbox SW (precache di tutto, ~4.4 MiB inclusi i 3.6 MiB di JSON), installabile su iOS/Android, prompt "Aggiungi a Home"
- **Stato utente**: tutto in IndexedDB tramite idb-keyval (zero localStorage, zero backend)
- **Mobile-first**: bottom nav, tap target ≥ 44 px, dark mode automatica
- **Accessibilità**: focus visibile, aria-label, navigazione tastiera

### Aggiornare i dati

Quando rigeneri il CSV, aggiorna anche il bundle JSON della PWA:

```bash
python -c "import csv,json; rows=[{**r,'id':(r.get('url_canonical') or r.get('url','')).rstrip('/')} for r in csv.DictReader(open('espositori_tuttofood_2026.csv',encoding='utf-8'))]; [r.pop('partita_iva',None) for r in rows]; open('pwa/public/data/espositori.json','w',encoding='utf-8').write(json.dumps(rows,ensure_ascii=False,separators=(',',':')))"
cd pwa && npm run build
```

### Deploy

#### GitHub Pages

Il repo si chiama `Dashboard-Tuttofood-2026-Milano`, quindi GitHub Pages serve la PWA da `/Dashboard-Tuttofood-2026-Milano/`. Per generare un build con la base path corretta:

```bash
cd pwa
VITE_BASE=/Dashboard-Tuttofood-2026-Milano/ npm run build
# poi commit & push del contenuto di dist/ sul branch gh-pages,
# oppure usa l'azione GitHub "Deploy static content to Pages"
```

Esempio di workflow GitHub Actions (`.github/workflows/pages.yml`):

```yaml
name: Deploy PWA to Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: pwa
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: pwa/package-lock.json }
      - run: npm ci
      - run: VITE_BASE=/Dashboard-Tuttofood-2026-Milano/ npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: pwa/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.dep.outputs.page_url }} }
    steps:
      - id: dep
        uses: actions/deploy-pages@v4
```

#### Vercel

Più semplice (no base path):

1. importa il repo
2. Project Root: `pwa`
3. Framework preset: **Vite**
4. Build command: `npm run build`, Output directory: `dist`
5. lascia `VITE_BASE` non valorizzato (default `./`)

### Note sul service worker

- precache di **tutti** gli asset, incluso `data/espositori.json` (3.6 MiB → `maximumFileSizeToCacheInBytes` alzato a 6 MiB in `vite.config.ts`)
- `registerType: "autoUpdate"` + `clientsClaim: true` → l'app si aggiorna alla riapertura
- la PWA è realmente offline-first: dopo la prima apertura, anche senza rete vedi tutti gli espositori, prendi note, fai export

### Struttura

```
pwa/
├── public/
│   ├── data/espositori.json     # bundled exhibitor data
│   ├── hall-plan.png            # Tuttofood official hall plan
│   ├── icons/                   # PWA icons (192/512/maskable)
│   └── favicon.svg
├── src/
│   ├── data/        loader, IndexedDB storage, size heuristics
│   ├── components/  BottomNav, ExhibitorCard, InstallPrompt
│   ├── views/       List, Map, Dashboard, Export
│   ├── hooks/       useDebounce
│   ├── state.tsx    AppStateProvider context
│   └── App.tsx, main.tsx, types.ts, index.css
├── tailwind.config.js
└── vite.config.ts   # vite + vite-plugin-pwa (Workbox)
```
