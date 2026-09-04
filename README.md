# CardioBench

CardioBench is a research repository of cardiology software interfaces: vendor
manuals, UI screenshots catalogued by screen type, and usability research with
extracted quantitative data.

The goal is to answer questions that are currently hard to answer: how do
fourteen different products design the ECG viewer, where does everyone put lead
selection, what does a report editor look like across vendors, and what does the
literature actually measure about any of it.

## Contents

| Directory | What is in it |
|---|---|
| `ecg-manuals/` | 129 vendor manuals across 34 manufacturers, organised by vendor slug |
| `screens/` | UI screenshots, cropped from manuals or captured from the web |
| `data/` | Generated JSON: the source of truth for the site |
| `pipeline/` | Extraction and classification scripts |
| `web/` | Next.js front end |
| `ux-study/`, `human-factors/`, `workflow/`, `education/`, `benchmark/` | 103 study abstracts from PubMed, one markdown file each |
| `docs/` | Design spec and implementation notes |

## Data model

Five generated files in `data/`:

- **`products.json`** — one entry per product, tagged across three orthogonal
  facets: clinical modality (resting ECG, Holter, ABPM, stress, telemetry,
  spirometry, AI analysis, education, cardiac rehab), architecture (embedded
  firmware, desktop client, server management, webapp, SaaS, mobile, wearable),
  and workflow function (acquisition, review, reporting, management,
  integration, telemedicine, education)
- **`screens.json`** — one entry per screenshot, with its screen type, the
  product it belongs to, and full provenance back to the manual page and bounding
  box it was cropped from
- **`patterns.json`** — the 18 screen types that organise the site
- **`manuals.json`** — manual metadata: pages, language, document type, CDN route
- **`studies.json`** — study metadata with extracted quantitative fields (SUS
  score, sample size, task time, error rate, devices evaluated)

## Screen types

`login-auth`, `worklist`, `patient-registration`, `live-acquisition`,
`ecg-viewer`, `measurements-interpretation`, `report-editor`, `report-output`,
`holter-analysis`, `stress-test`, `settings`, `user-management`,
`connectivity-integration`, `dashboard-home`, `search-filters`, `error-alert`,
`onboarding-wizard`, `calibration-leads`.

## How screenshots are extracted

Manual pages are not rendered and classified wholesale. Instead the pipeline
reads figure bounding boxes directly from the PDF structure and filters them
geometrically before any model sees an image:

1. `page.get_image_info()` returns each figure's bounding box in page
   coordinates
2. Figures are kept when they cover between 8% and 85% of the page, have an
   aspect ratio between 0.25 and 4.0, and are at least 150pt wide. The floor
   removes headers and logos, the ceiling separates full-page scans
3. Surviving figures are cropped deterministically, along with two pieces of
   text context: the italic caption below the figure and the paragraph above it
4. A vision model confirms each crop is a real UI screenshot rather than an
   electrode diagram, a cable photo or a printed trace, then assigns screen type
   and writes a caption

Measured on this corpus, step 2 reduces 12,608 pages to 2,993 crops with no
inference cost, and 1,842 of those (62%) come out carrying the vendor's own
figure caption.
Where the manual has a figure caption, the description comes from the vendor's
own text rather than from the model.

## Provenance

Every screenshot links back to its source: the manual, the page number and the
bounding box, or the URL and capture date. Captions taken from a manual are
quoted from the vendor's text. Nothing in the gallery is unattributed.

## Notes on the corpus

Manuals were collected from public vendor support pages, and collection was
lossy in ways worth stating plainly.

Of the 200 files carrying a `.pdf` extension in the original import, only 103
were PDFs. The other 97 were HTML error pages, 401 responses, "Not found"
bodies or empty files, and have been removed. Two casualties are worth naming:
the BTL CardioPoint manual was a 336-byte HTML page, so one of the most relevant
station suites has no manual here, and the three FDA human factors guidance
documents were also error pages, which emptied `regulatory/` entirely.

Eight manuals are full-page scans rather than editorial PDFs, holding 1,857
scanned pages between them, mostly older service manuals and circuit diagrams.
They need a different extraction route and are not yet processed.

The corpus skews heavily toward device firmware: of 96 products catalogued, 74
are embedded firmware, 11 desktop clients, 7 mobile apps, 6 wearables, 4 server
management systems and 2 webapps. Station software is the more useful comparison
and the thinner part of the collection.
