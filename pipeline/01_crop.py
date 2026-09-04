#!/usr/bin/env python3
"""Stage 1: crop candidate figures out of manual PDFs.

Deterministic and offline. No model runs here. The point of this stage is to
turn 12,608 manual pages into a few thousand cropped images that are *worth*
sending to a classifier, using nothing but the PDF's own figure geometry.

Why geometry and not page rendering: rendering every page and asking a model
"is there a screenshot here" costs one inference per page. But PDFs already
know where their figures are. `page.get_image_info()` returns a bounding box
per placed image, so the figures can be located and cut for free. The area
filter then removes the two dominant classes of non-figure: header logos at the
bottom end, and full-page scans at the top end.

Each crop carries its text context out with it. Editorial manuals caption their
figures in italic underneath ("Examination preview window with Full user
interface"), which means the vendor has already described the screen. Where
there is no caption, the paragraph above the figure usually describes the
action. Both are extracted so the classifier reads rather than guesses, and so
captions on the site can be quoted instead of generated.

Resumable: state per PDF in pipeline/state/, so a run can be interrupted and
picked up. Re-running skips PDFs already done unless --force.

Usage:
    python3 pipeline/01_crop.py                      # every manual
    python3 pipeline/01_crop.py --only cardioline    # vendor slug substring
    python3 pipeline/01_crop.py --limit 10 --force
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import warnings
from dataclasses import dataclass, asdict

warnings.filterwarnings("ignore")

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is required: pip install pymupdf")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANUALS_JSON = os.path.join(REPO, "data", "manuals.json")
CAND_DIR = os.path.join(REPO, "pipeline", "candidates")
STATE_DIR = os.path.join(REPO, "pipeline", "state")

# Geometry filter. Tuned against the corpus, see docs spec section 3.1.
MIN_AREA_FRAC = 0.08   # below this: header logos, inline icons, rule lines
MAX_AREA_FRAC = 0.85   # above this: the page is a scan, not a figure on a page
MIN_ASPECT = 0.25      # narrower than this: decorative bars and sidebars
MAX_ASPECT = 4.00      # wider than this: banners and page-width rules
MIN_WIDTH_PT = 150     # a screenshot narrower than this is unreadable anyway

CROP_DPI = 150         # enough to read UI labels without bloating the corpus
CAPTION_BAND_PT = 90   # how far below a figure to look for its caption
CONTEXT_ABOVE_PT = 120 # how far above to look for the describing paragraph

ITALIC_FLAG = 1 << 1


@dataclass
class Crop:
    id: str
    manual_id: str
    page: int                  # 1-indexed, as printed in the manual
    bbox: list                 # [x0, y0, x1, y1] in PDF points
    area_frac: float
    width_pt: float
    height_pt: float
    image: str                 # path relative to repo root
    caption: str | None        # italic text below the figure, verbatim
    context_above: str | None  # paragraph above the figure, verbatim


def spans_in_band(page, y_top: float, y_bottom: float):
    """Text spans whose top edge falls within a vertical band."""
    out = []
    try:
        blocks = page.get_text("dict")["blocks"]
    except Exception:
        return out
    for blk in blocks:
        if blk.get("type") != 0:
            continue
        for line in blk.get("lines", []):
            for span in line.get("spans", []):
                y = span["bbox"][1]
                if y_top <= y <= y_bottom:
                    out.append(span)
    return out


def extract_caption(page, bbox) -> str | None:
    """Italic text directly below the figure, which is how manuals caption.

    Prefers italic spans. Falls back to the nearest short line, because some
    vendors caption in a small roman face instead.
    """
    y_bot = bbox[3]
    spans = spans_in_band(page, y_bot, y_bot + CAPTION_BAND_PT)
    if not spans:
        return None
    italic = [s for s in spans if s.get("flags", 0) & ITALIC_FLAG]
    pool = italic or spans
    text = " ".join(s["text"] for s in sorted(pool, key=lambda s: (s["bbox"][1], s["bbox"][0])))
    text = " ".join(text.split())
    if not text or len(text) > 300:
        return None
    # A caption is a phrase, not a page of body copy. Long runs are body text.
    return text if len(text) >= 3 else None


def extract_context_above(page, bbox) -> str | None:
    """The paragraph above the figure. Where there is no caption, this is
    usually the sentence that says what the screen does."""
    y_top = bbox[1]
    spans = spans_in_band(page, max(0, y_top - CONTEXT_ABOVE_PT), y_top)
    if not spans:
        return None
    text = " ".join(s["text"] for s in sorted(spans, key=lambda s: (s["bbox"][1], s["bbox"][0])))
    text = " ".join(text.split())
    if not text:
        return None
    return text[-600:]


def figure_boxes(page):
    """Candidate figure bounding boxes on a page, after the geometry filter."""
    area = page.rect.width * page.rect.height
    if not area:
        return []
    try:
        infos = page.get_image_info()
    except Exception:
        return []
    boxes = []
    for info in infos:
        x0, y0, x1, y1 = info["bbox"]
        w, h = x1 - x0, y1 - y0
        if w <= 0 or h <= 0:
            continue
        frac = (w * h) / area
        aspect = w / h
        if not (MIN_AREA_FRAC <= frac <= MAX_AREA_FRAC):
            continue
        if not (MIN_ASPECT <= aspect <= MAX_ASPECT):
            continue
        if w < MIN_WIDTH_PT:
            continue
        boxes.append(((x0, y0, x1, y1), frac, w, h))
    # Deduplicate near-identical boxes: tiled figures can report overlapping
    # placements for what is visually one image.
    boxes.sort(key=lambda b: -b[1])
    kept = []
    for box, frac, w, h in boxes:
        if any(_overlaps(box, k[0]) for k in kept):
            continue
        kept.append((box, frac, w, h))
    return kept


def _overlaps(a, b, thresh: float = 0.6) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix = max(0, min(ax1, bx1) - max(ax0, bx0))
    iy = max(0, min(ay1, by1) - max(ay0, by0))
    inter = ix * iy
    if not inter:
        return False
    smaller = min((ax1 - ax0) * (ay1 - ay0), (bx1 - bx0) * (by1 - by0))
    return smaller > 0 and inter / smaller >= thresh


def crop_manual(manual: dict, force: bool = False) -> dict:
    mid = manual["id"]
    state_path = os.path.join(STATE_DIR, f"{mid}.json")
    if os.path.exists(state_path) and not force:
        return json.load(open(state_path))

    pdf_path = os.path.join(REPO, manual["path"])
    out_dir = os.path.join(CAND_DIR, mid)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(STATE_DIR, exist_ok=True)

    crops: list[Crop] = []
    scanned_pages = 0
    try:
        doc = fitz.open(pdf_path, filetype="pdf")
    except Exception as exc:
        state = {"manual_id": mid, "status": "error", "error": str(exc)[:200], "crops": []}
        json.dump(state, open(state_path, "w"), indent=1)
        return state

    for pno, page in enumerate(doc, start=1):
        area = page.rect.width * page.rect.height
        if not area:
            continue
        # Note a full-page scan so stage 3 can find these later.
        try:
            biggest = max(
                ((i["bbox"][2] - i["bbox"][0]) * (i["bbox"][3] - i["bbox"][1]) / area
                 for i in page.get_image_info()),
                default=0,
            )
        except Exception:
            biggest = 0
        if biggest > MAX_AREA_FRAC:
            scanned_pages += 1

        for idx, (box, frac, w, h) in enumerate(figure_boxes(page), start=1):
            cid = f"{mid}-p{pno:04d}-{idx}"
            fname = f"{cid}.png"
            try:
                pix = page.get_pixmap(clip=fitz.Rect(*box), dpi=CROP_DPI)
                pix.save(os.path.join(out_dir, fname))
            except Exception:
                continue
            crops.append(Crop(
                id=cid,
                manual_id=mid,
                page=pno,
                bbox=[round(v, 1) for v in box],
                area_frac=round(frac, 4),
                width_pt=round(w, 1),
                height_pt=round(h, 1),
                image=f"pipeline/candidates/{mid}/{fname}",
                caption=extract_caption(page, box),
                context_above=extract_context_above(page, box),
            ))

    doc.close()
    state = {
        "manual_id": mid,
        "status": "cropped",
        "pages": manual["pages"],
        "scanned_pages": scanned_pages,
        "crop_count": len(crops),
        "with_caption": sum(1 for c in crops if c.caption),
        "crops": [asdict(c) for c in crops],
    }
    json.dump(state, open(state_path, "w"), indent=1, ensure_ascii=False)
    return state


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="substring match on manual id or vendor slug")
    ap.add_argument("--limit", type=int, help="stop after N manuals")
    ap.add_argument("--force", action="store_true", help="redo manuals already cropped")
    args = ap.parse_args()

    manuals = json.load(open(MANUALS_JSON))
    if args.only:
        needle = args.only.lower()
        manuals = [m for m in manuals if needle in m["id"].lower() or needle in m["vendor_slug"].lower()]
    if args.limit:
        manuals = manuals[: args.limit]

    total_crops = total_caps = total_scan = 0
    for i, m in enumerate(manuals, start=1):
        state = crop_manual(m, force=args.force)
        if state.get("status") == "error":
            print(f"[{i}/{len(manuals)}] {m['id']}: ERROR {state['error']}")
            continue
        total_crops += state["crop_count"]
        total_caps += state["with_caption"]
        total_scan += state.get("scanned_pages", 0)
        print(f"[{i}/{len(manuals)}] {m['id']}: "
              f"{state['crop_count']} crops, {state['with_caption']} with caption, "
              f"{state.get('scanned_pages', 0)} scanned pages")

    print()
    print(f"manuals:        {len(manuals)}")
    print(f"crops:          {total_crops}")
    print(f"with caption:   {total_caps}"
          + (f" ({100*total_caps/total_crops:.0f}%)" if total_crops else ""))
    print(f"scanned pages:  {total_scan} (stage 3, not handled here)")


if __name__ == "__main__":
    main()
