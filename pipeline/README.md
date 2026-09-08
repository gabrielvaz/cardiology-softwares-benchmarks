# Pipeline

Turns vendor PDFs into `data/*.json`. Five stages, each resumable, no external
API and no API key. Deterministic work runs in Python; judgement runs in Claude
Code subagents reading the files off disk.

```
01_crop.py     PDF figures  ->  pipeline/candidates/*.png + pipeline/state/*.json
02_batch.py    crops        ->  work orders  ->  [subagents]  ->  data/screens.json
03            full-page scans (not implemented, see below)
04_studies.py  abstracts    ->  work orders  ->  [subagents]  ->  data/studies.json
05_build.py    everything   ->  WebP in screens/, counts recomputed
```

Stages 2 and 4 have the same three-step shape: `--make` writes work orders,
subagents write verdict files next to them, `--collect` validates and merges.
Nothing reaches `data/` without passing validation against a closed vocabulary.

## Why crops and not rendered pages

Rendering all 12,608 pages and asking a model "is there a screenshot here"
costs one inference per page. PDFs already record where their figures are, so
`page.get_image_info()` locates them for free and they can be cut exactly.

The area filter does the rest of the work before any model runs:

| Filter | Value | Removes |
|---|---|---|
| min area | 8% of page | header logos, inline icons, rules |
| max area | 85% of page | full-page scans, which are a different problem |
| aspect | 0.25 to 4.0 | decorative bars, page-width banners |
| min width | 150pt | figures too small to read anyway |

Measured on this corpus: 12,608 pages reduce to roughly 2,900 crops.

Extracting embedded images raw does **not** work here and should not be
attempted. `Marquette-MAC-15` reports 362 images across 362 pages because each
page is one scan. `Quinton-Q-Stress-4.5` reports 50,592 images across 248 pages
because its figures are stored as tiles. Bounding boxes are reliable; image
streams are not.

## Text context travels with each crop

Editorial manuals caption figures in italic underneath. In
`Cardioline-touchECG-user-manual`, 36 of 38 crops carried a caption, and the
captions are exactly the description the site needs: "Real time display window
with Quick user interface", "Patient window", "Real time display window with
disconnected lead."

So each crop is stored with two pieces of context:

- `caption` — italic text in the 90pt band below the figure
- `context_above` — the paragraph in the 120pt band above it

Where a caption exists it is quoted on the site, and `caption_source` is set to
`manual`. The model only writes a caption when the vendor did not.

The caption extraction is not clever, and does not need to be. On page 40 of
that same manual the two crops are electrode placement diagrams and the
"caption" picked up is body copy about the fifth rib. Geometry finds figures;
telling an interface apart from a diagram is the classifier's job.

## Stage 2: classifying crops

```bash
python3 pipeline/02_batch.py --make --size 25 --only meditech
python3 pipeline/02_batch.py --status
# dispatch one subagent per order file, then:
python3 pipeline/02_batch.py --collect
```

Batches are grouped by manual so one subagent sees one product's visual
language throughout, which keeps screen-type calls consistent.

### Subagent prompt for stage 2

> Read the work order at `pipeline/batches/<batch_id>.order.json`. It names a
> manual and lists crops taken from it, each with an image path, the page it
> came from, and any caption or surrounding text found in the PDF.
>
> Look at every image. For each crop, decide first whether it is a screenshot
> of a software or device user interface. Reject anything that is an electrode
> placement diagram, a photograph of hardware or cables, a printed ECG trace
> with no interface around it, a legal or regulatory notice, a chart or graph, a
> logo, a line illustration, or a table of text. Rejecting is normal: expect
> a large share of any batch to be rejected, and rejecting correctly is worth
> more than accepting generously.
>
> For each crop you accept, assign exactly one screen type from
> `data/patterns.json`, list the clinical modalities visible, and write a
> caption. If the crop already has a caption from the manual, keep the vendor's
> wording and do not paraphrase it. Only write your own caption when the manual
> gave none, and then describe what is on screen in one sentence, without
> praising or evaluating the design.
>
> Set `confidence` between 0 and 1 for how sure you are of the screen type, not
> of the rejection.
>
> One exception to keeping the vendor's wording: some manual captions are not
> descriptions at all. They are interaction instructions ("A Click to select the
> lead. B Click icon to terminate the zoom function.") or fragments of an axis
> label ("1 x 10s I … aVF 1 x 10s V1 … V6"). When the caption does not say what
> the screen *is*, write your own and set `caption_source_override` to `"model"`.
> Keep the vendor's caption only when it names or describes the screen.
>
> Write a JSON array to `pipeline/batches/<batch_id>.verdict.json`, one object
> per crop, using every `crop_id` from the order exactly once:
>
> ```json
> {"crop_id": "...", "is_ui_screenshot": true, "pattern": "ecg-viewer",
>  "modalities": ["resting-ecg"], "caption": "...", "confidence": 0.9}
> ```
>
> or, for a rejection:
>
> ```json
> {"crop_id": "...", "is_ui_screenshot": false, "reject_reason": "electrode-diagram"}
> ```
>
> Marketing material needs particular care. A screen inside a *drawn* device
> frame is still a screen and should be accepted. But reject anything where the
> interface is part of a **photograph**: a staged clinic scene with people, a
> laptop shot at an angle, a photograph of a physical monitor. Also reject
> brochure pages that combine photography with screens, or that stack several
> different screens into one image with marketing copy around them, because
> that image is a page layout, not a screen.
>
> `reject_reason` must be one of: electrode-diagram, hardware-photo,
> printed-trace, legal-notice, chart-or-graph, logo-or-branding, illustration,
> table-or-text, marketing-photo, marketing-composite, photo-of-screen,
> unreadable, other.
>
> Do not guess a screen type to avoid leaving a field empty. `--collect`
> rejects records with values outside the vocabulary rather than repairing
> them, because a repaired guess is indistinguishable from real data once it is
> published.

## Stage 3: full-page scans

Eight manuals are scans rather than editorial PDFs: Burdick E350i and Eclipse,
Cardioline Delta 1 Plus, Marquette MAC 12/15 and MAC PC, Nihon Kohden ECG-9320,
and the Siemens circuit diagrams. Together they hold 1,752 full-page images,
which the 85% ceiling excludes on purpose.

They need the opposite approach: render the page, have a model locate the
interface region, then crop to the returned box. Mostly older service manuals
and circuit diagrams, so the expected yield is low. Not implemented.

## Stage 4: study data

```bash
python3 pipeline/04_studies.py --make --size 12
python3 pipeline/04_studies.py --collect
```

### Subagent prompt for stage 4

> Read the work order at `pipeline/study-batches/<batch_id>.order.json`. Each
> entry is one study with its title, year, venue, DOI, and abstract.
>
> For each study, extract only what the abstract actually states. Fill `n`,
> `sus_score`, `task_time`, `error_rate`, `devices` and `product_ids` when the
> abstract reports them, and leave them null when it does not. Do not infer a
> sample size from a study design, do not convert a satisfaction score into a
> SUS score, and do not assume which commercial product was used when the
> abstract names only a device class.
>
> Classify `design` and `topics` from the abstract, not from the `declared_type`
> field in the order. That field is unreliable: a paper on GPT-4's ECG accuracy
> is filed as a usability study, and the corpus contains work on freely moving
> mice and injectable hydrogel electrodes.
>
> Set `has_quantitative_data` to true only when there is a measured usability or
> performance result a reader could compare against another study. Set `topics`
> to `["not-relevant"]` for studies with no bearing on cardiology software
> interfaces. Nothing is deleted for being irrelevant; it simply drops out of
> the table.
>
> Write a JSON array to `pipeline/study-batches/<batch_id>.verdict.json`, using
> every `study_id` from the order exactly once. `metric` and `result` are short
> free text: what was measured, and what came out.

## Stage 5: build

Converts accepted crops to WebP under `screens/`, recomputes screen and product
counts in `patterns.json` and `products.json`, and marks which manuals exceed
the 20 MB jsDelivr ceiling so the site routes them through
`raw.githubusercontent.com` instead. Two files currently do:
`Mortara-ELI-150c-250c-manual-alt.pdf` (22.8 MB) and
`Marquette-MAC-PC-ECG-service-manual.pdf` (20.5 MB).

## Scale

Roughly 2,900 crops at 25 per batch is about 116 subagent runs, which does not
fit in one session. State lives on disk per manual and per batch, so each
session advances a slice and `git diff` shows what entered. Process station
software and webapps first: they are the relevant comparison and the smaller
part of the corpus.

## Known quality gaps

**Weak manual captions.** 85% of accepted screens carry the vendor's own
caption, which is the right default, but a minority of those captions are
interaction instructions or axis-label fragments rather than descriptions of the
screen. The GE CardioSoft manual is the worst case, captioning figures as "A
Click to select the lead. B Click icon to terminate the zoom function." The
stage 2 prompt now instructs an override for these; batches classified before
that change still carry them.

**Taxonomy gaps found in use.** Subagents reported low confidence (0.35 to 0.55)
where a real screen has no matching slug: 3D vector loop analysis, waterfall and
T-wave alternans displays, and serial median comparison were all mapped onto
`ecg-viewer` or `measurements-interpretation` for lack of anywhere better.
Meditech PCS, being an EHR rather than a cardiology product, mapped onto the
taxonomy poorly throughout. Worth revisiting once more of the corpus is
classified and the real distribution of screen types is visible.

**Marketing photography got through the first run.** The original stage 2
prompt told the classifier that "a screenshot inside a device mockup is still a
screenshot", which was meant to rescue legitimate screens shown in a drawn
frame. It instead admitted stock photography: staged clinic scenes with
patients and clinicians, with a workstation visible in shot. An audit of all
181 accepted screens found 7 such cases, every one of them from a marketing
brochure rather than a manual, and all 7 were removed. The prompt above now
draws the line at *photographed* versus *drawn*, and three reject reasons were
added for it. Brochures remain the highest-risk source in the corpus.

**`user-management` is still empty.** 17 of 18 patterns have screens; nothing in
the processed subset shows an account or permissions screen, which is plausible
rather than suspicious: vendors document them rarely.
