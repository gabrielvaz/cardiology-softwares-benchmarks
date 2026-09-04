#!/usr/bin/env python3
"""Stage 4: turn 167 study abstracts into a quantitative table.

The corpus arrived from PubMed as one markdown file per study, with a small
metadata header and the abstract as prose. Everything worth comparing lives
inside that prose: SUS scores, sample sizes, task completion times, error
rates, and which device or software was actually evaluated.

Like stage 2, this script does no inference. `--make` writes work orders,
subagents read the abstracts and extract fields, `--collect` validates and
merges.

Two design notes:

The existing `Study type` classification in the markdown headers is not
trusted. A paper comparing GPT-4's ECG accuracy is filed as
"Usability/UX study", and `ux-study/` contains work on freely moving mice and
injectable hydrogel electrodes. Subagents reclassify from the abstract.

Nothing is deleted for being irrelevant. A study with no measurable usability
finding gets `has_quantitative_data: false` and drops out of the table on its
own, which is a filter that costs nothing and stays auditable.

Usage:
    python3 pipeline/04_studies.py --make --size 12
    python3 pipeline/04_studies.py --status
    python3 pipeline/04_studies.py --collect
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO, "data")
BATCH_DIR = os.path.join(REPO, "pipeline", "study-batches")

STUDY_DIRS = ["ux-study", "human-factors", "workflow", "education", "benchmark", "research"]

DESIGNS = {
    "rct", "non-randomised-trial", "observational", "cohort", "case-control",
    "cross-sectional", "usability-test", "heuristic-evaluation", "survey",
    "diagnostic-accuracy", "simulation", "pilot", "case-report",
    "systematic-review", "narrative-review", "algorithm-development", "other",
}
TOPICS = {
    "usability", "human-factors", "workflow", "education", "diagnostic-accuracy",
    "ai-algorithm", "signal-processing", "device-validation", "telemedicine",
    "not-relevant",
}


def parse_markdown(path: str) -> dict:
    """Pull the header fields and abstract out of one study file."""
    text = open(path, encoding="utf-8", errors="replace").read()
    out = {"source_file": os.path.relpath(path, REPO)}
    m = re.search(r"^#\s+(.+)$", text, re.M)
    out["title"] = m.group(1).strip() if m else None
    for key, field in [
        ("Year", "year"), ("Venue", "venue"), ("DOI", "doi"),
        ("Study type", "declared_type"), ("Clinical context", "declared_context"),
        ("Link", "link"),
    ]:
        m = re.search(rf"^-\s*{key}:\s*(.+)$", text, re.M)
        out[field] = m.group(1).strip() if m else None
    m = re.search(r"^##\s+Abstract\s*$(.+?)(?=^##\s|\Z)", text, re.M | re.S)
    out["abstract"] = " ".join(m.group(1).split()) if m else None
    m = re.search(r"PMID(\d+)", os.path.basename(path))
    out["pmid"] = m.group(1) if m else None
    if out.get("year"):
        try:
            out["year"] = int(re.sub(r"\D", "", out["year"])[:4])
        except ValueError:
            out["year"] = None
    return out


def load_studies() -> list[dict]:
    studies = []
    for d in STUDY_DIRS:
        for path in sorted(glob.glob(os.path.join(REPO, d, "*.md"))):
            rec = parse_markdown(path)
            rec["corpus_dir"] = d
            rec["id"] = os.path.splitext(os.path.basename(path))[0].lower()
            studies.append(rec)
    return studies


def already_done() -> set[str]:
    done = set()
    for p in glob.glob(os.path.join(BATCH_DIR, "*.verdict.json")):
        try:
            for rec in json.load(open(p)):
                if "study_id" in rec:
                    done.add(rec["study_id"])
        except Exception:
            continue
    return done


def cmd_make(args):
    studies = load_studies()
    with_abstract = [s for s in studies if s.get("abstract")]
    done = already_done()
    todo = [s for s in with_abstract if s["id"] not in done]
    print(f"{len(studies)} study files, {len(with_abstract)} with an abstract, "
          f"{len(todo)} still to extract")
    if not todo:
        return
    os.makedirs(BATCH_DIR, exist_ok=True)
    made = 0
    for i in range(0, len(todo), args.size):
        chunk = todo[i : i + args.size]
        bid = f"studies-{i // args.size + 1:03d}"
        json.dump({"batch_id": bid, "studies": chunk},
                  open(os.path.join(BATCH_DIR, f"{bid}.order.json"), "w"),
                  indent=1, ensure_ascii=False)
        made += 1
    print(f"{made} batches written to pipeline/study-batches/")


def cmd_status(args):
    orders = glob.glob(os.path.join(BATCH_DIR, "*.order.json"))
    verdicts = glob.glob(os.path.join(BATCH_DIR, "*.verdict.json"))
    have = {os.path.basename(p).split(".")[0] for p in verdicts}
    pending = [os.path.basename(p).split(".")[0] for p in orders
               if os.path.basename(p).split(".")[0] not in have]
    print(f"orders: {len(orders)}  verdicts: {len(verdicts)}  pending: {len(pending)}")
    for b in sorted(pending):
        print("   ", b)


def validate(rec: dict, valid_ids: set[str]) -> str | None:
    sid = rec.get("study_id")
    if sid not in valid_ids:
        return f"study_id not in batch: {sid!r}"
    if not isinstance(rec.get("has_quantitative_data"), bool):
        return "has_quantitative_data must be a boolean"
    if rec.get("design") not in DESIGNS:
        return f"design outside vocabulary: {rec.get('design')!r}"
    topics = rec.get("topics") or []
    if not isinstance(topics, list) or any(t not in TOPICS for t in topics):
        return f"topics outside vocabulary: {topics!r}"
    for num, lo, hi in [("sus_score", 0, 100), ("n", 1, 10_000_000)]:
        v = rec.get(num)
        if v is not None and not (isinstance(v, (int, float)) and lo <= v <= hi):
            return f"{num} out of range: {v!r}"
    if rec["has_quantitative_data"]:
        has_any = any(rec.get(k) is not None for k in
                      ("sus_score", "task_time", "error_rate", "n", "metric"))
        if not has_any:
            return "has_quantitative_data is true but no measured field is filled"
    return None


def cmd_collect(args):
    by_id = {s["id"]: s for s in load_studies()}
    merged, errors = [], []
    for vpath in sorted(glob.glob(os.path.join(BATCH_DIR, "*.verdict.json"))):
        bid = os.path.basename(vpath).replace(".verdict.json", "")
        opath = os.path.join(BATCH_DIR, f"{bid}.order.json")
        if not os.path.exists(opath):
            errors.append((bid, "verdict without a matching order"))
            continue
        valid_ids = {s["id"] for s in json.load(open(opath))["studies"]}
        try:
            recs = json.load(open(vpath))
        except Exception as exc:
            errors.append((bid, f"unparseable JSON: {exc}"))
            continue
        for rec in recs:
            err = validate(rec, valid_ids)
            if err:
                errors.append((bid, f"{rec.get('study_id')}: {err}"))
                continue
            base = by_id[rec["study_id"]]
            merged.append({
                "id": base["id"],
                "pmid": base.get("pmid"),
                "doi": base.get("doi"),
                "title": base.get("title"),
                "year": base.get("year"),
                "venue": base.get("venue"),
                "corpus_dir": base.get("corpus_dir"),
                "source_file": base["source_file"],
                "design": rec["design"],
                "topics": rec.get("topics") or [],
                "n": rec.get("n"),
                "sus_score": rec.get("sus_score"),
                "task_time": rec.get("task_time"),
                "error_rate": rec.get("error_rate"),
                "devices": rec.get("devices") or [],
                "product_ids": rec.get("product_ids") or [],
                "metric": rec.get("metric"),
                "result": rec.get("result"),
                "has_quantitative_data": rec["has_quantitative_data"],
            })

    if errors and not args.allow_errors:
        print(f"REFUSING TO WRITE: {len(errors)} validation errors\n")
        for bid, err in errors[:40]:
            print(f"  [{bid}] {err}")
        print("\nFix the verdict files, or re-run with --allow-errors.")
        sys.exit(1)

    json.dump(merged, open(os.path.join(DATA_DIR, "studies.json"), "w"),
              indent=1, ensure_ascii=False)
    quant = [s for s in merged if s["has_quantitative_data"]]
    sus = [s["sus_score"] for s in quant if s["sus_score"] is not None]
    print(f"studies.json: {len(merged)} studies, {len(quant)} with quantitative data")
    print(f"with SUS score: {len(sus)}"
          + (f"  (range {min(sus):.0f} to {max(sus):.0f})" if sus else ""))
    print("designs:", dict(Counter(s["design"] for s in merged).most_common(8)))
    print("topics:", dict(Counter(t for s in merged for t in s["topics"]).most_common()))
    if errors:
        print(f"skipped {len(errors)} invalid records")


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--make", action="store_true")
    g.add_argument("--status", action="store_true")
    g.add_argument("--collect", action="store_true")
    ap.add_argument("--size", type=int, default=12)
    ap.add_argument("--allow-errors", action="store_true")
    args = ap.parse_args()
    if args.make:
        cmd_make(args)
    elif args.status:
        cmd_status(args)
    else:
        cmd_collect(args)


if __name__ == "__main__":
    main()
