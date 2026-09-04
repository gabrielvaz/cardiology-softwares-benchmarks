#!/usr/bin/env python3
"""Stage 5: promote accepted crops into the published asset tree.

Stages 1 and 2 work in `pipeline/candidates/`, which is gitignored scratch
space holding every crop the geometry filter found, accepted or not. This stage
takes only the crops that survived classification, converts them to WebP under
`screens/`, and rewrites `data/screens.json` to point at the published path.

That separation is the point: the candidate tree can be regenerated from the
PDFs at any time and never needs to be committed, while `screens/` holds only
what the site actually shows and is small enough to live in the repo and be
served from a CDN.

Also recomputes the counts in `products.json` and `patterns.json`, so no page
has to derive them at build time from a full scan.

Usage:
    python3 pipeline/05_build.py
    python3 pipeline/05_build.py --quality 82 --max-width 1600
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
from collections import Counter

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Pillow is required: pip install pillow")

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO, "data")
SCREENS_DIR = os.path.join(REPO, "screens")


def vendor_of(screen: dict, manuals: dict, products: dict) -> str:
    """Where a screen's image should live. Vendor slug keeps the tree browsable
    and matches how ecg-manuals/ is already organised."""
    mid = screen.get("source", {}).get("manual_id")
    if mid and mid in manuals:
        return manuals[mid]["vendor_slug"]
    pid = screen.get("product_id")
    if pid and pid in products:
        return products[pid]["vendor_slug"]
    return "unattributed"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quality", type=int, default=80)
    ap.add_argument("--max-width", type=int, default=1600,
                    help="downscale wider crops; UI labels stay legible well below this")
    ap.add_argument("--force", action="store_true", help="re-encode images that already exist")
    args = ap.parse_args()

    screens = json.load(open(os.path.join(DATA_DIR, "screens.json")))
    manuals = {m["id"]: m for m in json.load(open(os.path.join(DATA_DIR, "manuals.json")))}
    products = {p["id"]: p for p in json.load(open(os.path.join(DATA_DIR, "products.json")))}

    converted = skipped = missing = copied = 0
    bytes_in = bytes_out = 0

    for s in screens:
        src_rel = s["image"]
        # Web-captured seed images already sit under screens/; leave them alone.
        if src_rel.startswith("screens/"):
            copied += 1
            continue

        src = os.path.join(REPO, src_rel)
        if not os.path.exists(src):
            missing += 1
            continue

        vendor = vendor_of(s, manuals, products)
        out_rel = f"screens/{vendor}/{s['id']}.webp"
        out = os.path.join(REPO, out_rel)

        if os.path.exists(out) and not args.force:
            s["image"] = out_rel
            skipped += 1
            continue

        os.makedirs(os.path.dirname(out), exist_ok=True)
        try:
            with Image.open(src) as im:
                im = im.convert("RGB")
                if im.width > args.max_width:
                    ratio = args.max_width / im.width
                    im = im.resize((args.max_width, round(im.height * ratio)), Image.LANCZOS)
                w, h = im.size
                im.save(out, "WEBP", quality=args.quality, method=6)
        except Exception as exc:
            print(f"  failed {s['id']}: {exc}")
            missing += 1
            continue

        bytes_in += os.path.getsize(src)
        bytes_out += os.path.getsize(out)
        s["image"] = out_rel
        s["width"], s["height"] = w, h
        converted += 1

    # Recompute counts so the site never has to.
    per_product = Counter(s["product_id"] for s in screens if s.get("product_id"))
    per_pattern = Counter(s["pattern"] for s in screens if s.get("pattern"))

    prod_list = json.load(open(os.path.join(DATA_DIR, "products.json")))
    for p in prod_list:
        p["screen_count"] = per_product.get(p["id"], 0)
    json.dump(prod_list, open(os.path.join(DATA_DIR, "products.json"), "w"),
              indent=1, ensure_ascii=False)

    pat_list = json.load(open(os.path.join(DATA_DIR, "patterns.json")))
    for p in pat_list:
        p["screen_count"] = per_pattern.get(p["slug"], 0)
    json.dump(pat_list, open(os.path.join(DATA_DIR, "patterns.json"), "w"),
              indent=1, ensure_ascii=False)

    json.dump(screens, open(os.path.join(DATA_DIR, "screens.json"), "w"),
              indent=1, ensure_ascii=False)

    print(f"converted to WebP: {converted}")
    print(f"already present:   {skipped}")
    print(f"left in place:     {copied} (web captures)")
    if missing:
        print(f"missing source:    {missing}")
    if bytes_in:
        print(f"size: {bytes_in/1048576:.1f} MB PNG -> {bytes_out/1048576:.1f} MB WebP "
              f"({100*bytes_out/bytes_in:.0f}%)")
    total = sum(os.path.getsize(os.path.join(dp, f))
                for dp, _, fs in os.walk(SCREENS_DIR) for f in fs)
    print(f"screens/ total: {total/1048576:.1f} MB")
    print()
    print("patterns with screens:", sum(1 for p in pat_list if p["screen_count"]), "of", len(pat_list))
    print("products with screens:", sum(1 for p in prod_list if p["screen_count"]), "of", len(prod_list))


if __name__ == "__main__":
    main()
