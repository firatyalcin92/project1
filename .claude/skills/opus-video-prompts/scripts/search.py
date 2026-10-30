#!/usr/bin/env python3
"""Search the bundled Opus 5.5 video prompt library.

Usage:
  search.py [keywords...] [--category motion|3d|explainer|interactive]
            [--tag canvas|svg|threejs|shader|gsap|css|audio|...] [--limit N] [--full]
  search.py --slug <slug>      # print one entry in full
  search.py --stats            # list categories and tags
"""
import argparse, json, os, re, sys
from collections import Counter

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "videos.json")


def load():
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def show(v, full):
    print(f"## {v['slug']}  [{v['category']}] {', '.join(v['tech_tags'])}")
    print(f"by @{v['author']} · {v['post_url']}" + (" · (partial prompt)" if v.get("prompt_partial") else ""))
    p = v.get("prompt") or ""
    print(p if full else (p[:400] + ("…" if len(p) > 400 else "")))
    print()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keywords", nargs="*")
    ap.add_argument("--category")
    ap.add_argument("--tag", action="append", default=[])
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--slug")
    ap.add_argument("--stats", action="store_true")
    a = ap.parse_args()
    vids = load()

    if a.stats:
        print("categories:", dict(Counter(v["category"] for v in vids)))
        print("tags:", dict(Counter(t for v in vids for t in v["tech_tags"]).most_common()))
        return
    if a.slug:
        for v in vids:
            if v["slug"] == a.slug:
                return show(v, True)
        sys.exit(f"slug not found: {a.slug}")

    words = [w.lower() for w in a.keywords]
    scored = []
    for v in vids:
        if a.category and v["category"] != a.category:
            continue
        if any(t not in v["tech_tags"] for t in a.tag):
            continue
        text = (v.get("prompt") or "").lower()
        score = sum(len(re.findall(re.escape(w), text)) for w in words)
        if words and score == 0:
            continue
        # prefer complete prompts that also have a verified remake
        score += 0.5 * (not v.get("prompt_partial")) + 0.5 * bool(v.get("has_remake"))
        scored.append((score, v))
    scored.sort(key=lambda x: -x[0])
    print(f"{len(scored)} matches, showing {min(a.limit, len(scored))}\n")
    for _, v in scored[: a.limit]:
        show(v, a.full)


if __name__ == "__main__":
    main()
