#!/usr/bin/env python3
"""Stage 2: batch the crops for classification, then collect the verdicts.

This script never calls a model. Classification is done by Claude Code
subagents: `--make` writes the work orders, the agents read the images and
write their verdicts, and `--collect` validates and merges them.

That split exists so the expensive part is resumable and auditable. A batch
either has a verdict file or it does not, so a run can stop anywhere and pick
up later, and every verdict sits on disk as reviewable JSON before it reaches
data/screens.json.

`--collect` is deliberately strict. A subagent that invents a screen type, a
modality outside the vocabulary, or a crop id that was not in its batch has its
record rejected rather than repaired, because a silently repaired guess is
indistinguishable from real data once it is published.

Usage:
    python3 pipeline/02_batch.py --make --size 25 --only meditech
    python3 pipeline/02_batch.py --status
    python3 pipeline/02_batch.py --collect
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from collections import Counter, defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_DIR = os.path.join(REPO, "pipeline", "state")
BATCH_DIR = os.path.join(REPO, "pipeline", "batches")
DATA_DIR = os.path.join(REPO, "data")

PATTERNS = {p["slug"] for p in json.load(open(os.path.join(DATA_DIR, "patterns.json")))}
MODALITIES = {
    "resting-ecg", "holter", "abpm", "stress-test", "telemetry", "spirometry",
    "ai-analysis", "education", "cardiac-rehab", "defibrillation", "patient-monitoring",
}
REJECT_REASONS = {
    "electrode-diagram", "hardware-photo", "printed-trace", "legal-notice",
    "chart-or-graph", "logo-or-branding", "illustration", "table-or-text",
    "unreadable", "other",
    # Added after an audit found staged marketing imagery had been accepted:
    # the original stage 2 prompt said a screen inside a device mockup still
    # counts, which let brochure photography through.
    "marketing-photo",      # staged scene with people; a screen may be visible in it
    "marketing-composite",  # brochure page mixing photography with one or more screens
    "photo-of-screen",      # photograph of a physical monitor rather than a capture
}


def load_crops(only: str | None) -> list[dict]:
    crops = []
    for path in sorted(glob.glob(os.path.join(STATE_DIR, "*.json"))):
        state = json.load(open(path))
        if state.get("status") != "cropped":
            continue
        if only and only.lower() not in state["manual_id"].lower():
            continue
        crops.extend(state.get("crops", []))
    return crops


def already_classified() -> set[str]:
    done = set()
    for path in glob.glob(os.path.join(BATCH_DIR, "*.verdict.json")):
        try:
            for rec in json.load(open(path)):
                if "crop_id" in rec:
                    done.add(rec["crop_id"])
        except Exception:
            continue
    return done


def cmd_make(args):
    manuals = {m["id"]: m for m in json.load(open(os.path.join(DATA_DIR, "manuals.json")))}
    crops = load_crops(args.only)
    done = already_classified()
    todo = [c for c in crops if c["id"] not in done]
    if not todo:
        print("nothing to batch: every crop already has a verdict")
        return

    os.makedirs(BATCH_DIR, exist_ok=True)
    # Group by manual so one batch stays within one product's visual language,
    # which makes the screen-type call easier and more consistent.
    by_manual = defaultdict(list)
    for c in todo:
        by_manual[c["manual_id"]].append(c)

    made = 0
    for mid, items in sorted(by_manual.items()):
        man = manuals.get(mid, {})
        for i in range(0, len(items), args.size):
            chunk = items[i : i + args.size]
            bid = f"{mid}--{i // args.size + 1:02d}"
            order = {
                "batch_id": bid,
                "manual": {
                    "id": mid,
                    "title": man.get("title"),
                    "vendor_slug": man.get("vendor_slug"),
                    "pages": man.get("pages"),
                    "doc_type": man.get("doc_type"),
                    "lang": man.get("lang"),
                },
                "crops": [
                    {
                        "crop_id": c["id"],
                        "image": c["image"],
                        "page": c["page"],
                        "caption": c["caption"],
                        "context_above": c["context_above"],
                    }
                    for c in chunk
                ],
            }
            json.dump(order, open(os.path.join(BATCH_DIR, f"{bid}.order.json"), "w"),
                      indent=1, ensure_ascii=False)
            made += 1
    print(f"{made} batches written to pipeline/batches/ ({len(todo)} crops, size {args.size})")
    print(f"skipped {len(crops) - len(todo)} crops that already have verdicts")


def cmd_status(args):
    orders = glob.glob(os.path.join(BATCH_DIR, "*.order.json"))
    verdicts = glob.glob(os.path.join(BATCH_DIR, "*.verdict.json"))
    have = {os.path.basename(p).split(".")[0] for p in verdicts}
    pending = [p for p in orders
               if os.path.basename(p).split(".")[0] not in have]
    print(f"orders:   {len(orders)}")
    print(f"verdicts: {len(verdicts)}")
    print(f"pending:  {len(pending)}")
    for p in sorted(pending)[:20]:
        print("   ", os.path.basename(p).replace(".order.json", ""))
    if len(pending) > 20:
        print(f"    ... and {len(pending) - 20} more")


def validate(rec: dict, valid_ids: set[str]) -> str | None:
    """Returns an error string, or None when the record is acceptable."""
    cid = rec.get("crop_id")
    if cid not in valid_ids:
        return f"crop_id not in batch: {cid!r}"
    if not isinstance(rec.get("is_ui_screenshot"), bool):
        return "is_ui_screenshot must be a boolean"
    if rec["is_ui_screenshot"]:
        if rec.get("pattern") not in PATTERNS:
            return f"pattern outside vocabulary: {rec.get('pattern')!r}"
        mods = rec.get("modalities") or []
        if not isinstance(mods, list) or any(m not in MODALITIES for m in mods):
            return f"modalities outside vocabulary: {mods!r}"
        conf = rec.get("confidence")
        if not isinstance(conf, (int, float)) or not 0 <= conf <= 1:
            return f"confidence must be 0..1, got {conf!r}"
        if not rec.get("caption"):
            return "an accepted screenshot needs a caption"
    else:
        if rec.get("reject_reason") not in REJECT_REASONS:
            return f"reject_reason outside vocabulary: {rec.get('reject_reason')!r}"
    return None


def cmd_collect(args):
    manuals = {m["id"]: m for m in json.load(open(os.path.join(DATA_DIR, "manuals.json")))}
    crop_by_id = {c["id"]: c for c in load_crops(None)}

    accepted, rejected, errors = [], [], []
    for vpath in sorted(glob.glob(os.path.join(BATCH_DIR, "*.verdict.json"))):
        bid = os.path.basename(vpath).replace(".verdict.json", "")
        opath = os.path.join(BATCH_DIR, f"{bid}.order.json")
        if not os.path.exists(opath):
            errors.append((bid, "verdict without a matching order"))
            continue
        order = json.load(open(opath))
        valid_ids = {c["crop_id"] for c in order["crops"]}
        try:
            recs = json.load(open(vpath))
        except Exception as exc:
            errors.append((bid, f"unparseable JSON: {exc}"))
            continue
        seen = set()
        for rec in recs:
            err = validate(rec, valid_ids)
            if err:
                errors.append((bid, f"{rec.get('crop_id')}: {err}"))
                continue
            seen.add(rec["crop_id"])
            (accepted if rec["is_ui_screenshot"] else rejected).append(rec)
        missing = valid_ids - seen
        for m in missing:
            errors.append((bid, f"{m}: no verdict returned"))

    # Build screens.json: the seeded web captures plus the accepted crops.
    screens = []
    seed_path = os.path.join(DATA_DIR, "screens.seed.json")
    if os.path.exists(seed_path):
        screens.extend(json.load(open(seed_path)))

    for rec in accepted:
        crop = crop_by_id[rec["crop_id"]]
        man = manuals.get(crop["manual_id"], {})
        screens.append({
            "id": rec["crop_id"],
            "product_id": rec.get("product_id") or man.get("product_id"),
            "pattern": rec["pattern"],
            "modalities": rec.get("modalities") or [],
            "image": crop["image"],
            "caption": rec["caption"],
            "caption_source": "manual" if crop.get("caption") else "model",
            "confidence": rec["confidence"],
            "lang": man.get("lang", "unknown"),
            "source": {
                "type": "manual",
                "manual_id": crop["manual_id"],
                "page": crop["page"],
                "bbox": crop["bbox"],
            },
        })

    if errors and not args.allow_errors:
        print(f"REFUSING TO WRITE: {len(errors)} validation errors\n")
        for bid, err in errors[:40]:
            print(f"  [{bid}] {err}")
        if len(errors) > 40:
            print(f"  ... and {len(errors) - 40} more")
        print("\nFix the verdict files, or re-run with --allow-errors to skip bad records.")
        sys.exit(1)

    json.dump(screens, open(os.path.join(DATA_DIR, "screens.json"), "w"),
              indent=1, ensure_ascii=False)
    json.dump(rejected, open(os.path.join(DATA_DIR, "rejected.json"), "w"),
              indent=1, ensure_ascii=False)

    print(f"screens.json:  {len(screens)} screens")
    print(f"rejected.json: {len(rejected)} crops filtered out")
    if errors:
        print(f"skipped:       {len(errors)} invalid records (--allow-errors)")
    print()
    print("by pattern:", dict(Counter(s["pattern"] for s in screens).most_common()))
    print("reject reasons:", dict(Counter(r.get("reject_reason") for r in rejected).most_common()))
    caps = Counter(s.get("caption_source") for s in screens)
    print("caption source:", dict(caps))


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--make", action="store_true", help="write work orders for subagents")
    g.add_argument("--status", action="store_true", help="how many batches are pending")
    g.add_argument("--collect", action="store_true", help="validate verdicts, build screens.json")
    ap.add_argument("--size", type=int, default=25, help="crops per batch")
    ap.add_argument("--only", help="substring match on manual id")
    ap.add_argument("--allow-errors", action="store_true",
                    help="skip invalid records instead of refusing to write")
    args = ap.parse_args()

    if args.make:
        cmd_make(args)
    elif args.status:
        cmd_status(args)
    else:
        cmd_collect(args)


if __name__ == "__main__":
    main()
