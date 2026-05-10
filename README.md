# The UFO Files

A Gmail‑style archive for the **161 declassified UAP records** released by the
U.S. Department of War on **8 May 2026** as part of the Presidential
Unsealing and Reporting System for UAP Encounters (**PURSUE**) Release 01.

Live site: <https://dist-yrxkdlqx.devinapps.com>
Source PDFs/videos are served directly from <https://www.war.gov/UFO/>.

## Apps

The dock has nine apps. Everything is a static site — no backend, no build step.

- **Umail** – Gmail‑style inbox of all 161 records, with sidebar filters
  (agency, type, witness), starring, FOIA-request modal, record viewer with
  attachments / PDF viewer / video player / share / star / Umeni "Explain".
- **UTube** – YouTube‑style video page with worldwide audience comments
  (seeded from `data/comments_seed.json`), like/save/subscribe row, related
  videos rail.
- **UDrive** – Google Drive‑style file browser (folders by agency, file
  cards, sort, list/grid view).
- **UPhotos** – Google Photos‑style grid with two tabs:
  *Photos* (DoW/FBI release stills) and *Embedded in documents* (≈190 images
  extracted from the PDFs themselves; click → lightbox + "Source PDF" link).
- **UEarth** – UAP atlas built on Leaflet + MarkerCluster + Leaflet.heat.
  Clustered pins, density heatmap, **year window slider** (1945–2026),
  agency filter chips, off‑Earth incidents panel (Apollo / Gemini /
  lunar / orbital), top-locations sidebar. Atlas data merged from
  [`AlexZhangji/ufo-pursue-open-atlas`](https://github.com/AlexZhangji/ufo-pursue-open-atlas)
  (CC0) with year/lat/lng cleanup.
- **UCalendar** – timeline of every dated sighting grouped by year, with
  short briefs and "By month" toggle.
- **USearch** – **full-text search across every page of every PDF**
  (4,147 pages indexed, including FBI scans). Uses cleaned VLM-extracted
  text from the open atlas project so scanned pages are fully searchable.
  Results show the matching snippet with `<mark>` highlighting and deep-link
  to the source page.
- **Umeni** – Gemini‑style assistant grounded in the file text +
  descriptions; falls back to clearly-marked external context (`↪`) for
  things like Roswell / Project Blue Book context.
- **Support (☕)** – Ko-fi support pill linking to
  [ko-fi.com/theufofiles](https://ko-fi.com/theufofiles).

## Data files (`data/`)

| File              | What's in it                                             |
| ----------------- | -------------------------------------------------------- |
| `records.json`    | The 161 records as released by Department of War (CSV → JSON). |
| `enriched.json`   | `records.json` + atlas metadata (year, date_iso, lat/lng, agency_color, cluster_key). |
| `text_index.json` | Per-record concatenated text used by Umeni and ranked search. |
| `pdf_pages.json`  | Per-page text for every PDF (≈4,147 entries) used by USearch. |
| `pdf_images.json` | Images extracted from the PDFs (for the UPhotos doc tab). |
| `witnesses.json`  | Named witnesses + which records they appear in.          |
| `comments_seed.json` | Worldwide-style audience comments seeded for UTube.   |
| `geo.json`        | Per-record `{lat,lng,location}` used as a base layer.    |

## Hosting

The site is a flat static site — `index.html` + `app.js` + `views.js` + `umeni.js`
+ `styles.css` + `data/` + the image folders. Drop the whole repo into any
static host:

```bash
# local quick test
python3 -m http.server 8000
# then open http://localhost:8000
```

For your name.com domain, point the document root at the repo root (or any
fork of it). No build pipeline required.

## Tools (`tools/`)

Python helpers used to prepare the data — they are not run at request time.

- `enrich.py` – merges `records.json` with the open-atlas data, fixes the
  off-by-century year bugs, normalises agency colours.
- `extract_images.py` / `optimize_images.py` – curated image extraction
  (the original ~190-image set used in earlier releases).
- `extract_images_all.py` – **full-document image dump** (2,349 images
  from 87 PDFs). Runs `pdfimages` over every PDF, dedupes near-duplicates
  per-PDF via perceptual hashing, and writes thumbnails. Required at
  build time because the resulting `extracted_images/` and
  `extracted_thumbs/` folders are gitignored.
- `shrink_images.py` / `cap_for_deploy.py` – clamp full-image dimensions
  and keep top-N images per PDF for the live preview deploy.
- `build_search_index.py` – builds `pdf_pages.json` and `text_index.json`
  from the open-atlas `corpus.jsonl`.

## Credits & data sources

- **Records, PDFs, videos, photos** — U.S. Department of War,
  PURSUE Release 01, 8 May 2026 (<https://www.war.gov/UFO/>). Public-domain
  U.S. government work product.
- **Atlas + cleaned per-page text** — Alex Zhangji, *ufo-pursue-open-atlas*
  (CC0): <https://github.com/AlexZhangji/ufo-pursue-open-atlas>.
- **Inspiration** — `jmail.world` (Epstein Files), `ufo.gpt2077.com`.

If you'd like to support keeping this online: <https://ko-fi.com/theufofiles>
