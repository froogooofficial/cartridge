#!/usr/bin/env python3
"""brief.json + one feed row -> one compact VASCO scene dict.

Determinism is the whole point. The scene is a pure function of
(brief, row, seed): no clock, no unseeded randomness, no dict iteration order
that depends on insertion timing. Variety across the batch comes from hashing
the row id, so the same row always gets the same palette and the same motion —
re-run the batch tomorrow and byte-identical .idm files come out.

Font choice is also part of the function: each string picks the first font in
its role's fallback chain that actually covers it, so a CJK name gets a CJK-
capable face instead of a row of tofu. If nothing in the chain covers it, the
row is left with the primary font and QA fails it loudly rather than the
renderer shipping boxes.
"""
import hashlib
import json

from fontcov import first_covering, fit_block

# Size ladder per beat, largest first. The layout engine walks down it until the
# string fits the box, so a 2-character name and a 38-character name both land
# as a deliberate composition instead of one overflowing and one looking lost.
SIZE_LADDER = {
    "hook":    [190, 160, 132, 108, 88],
    "minutes": [300, 250, 210, 170, 140],
    "artist":  [200, 168, 140, 116, 96, 80],
    "song":    [150, 126, 104, 86, 72, 60],
    "badge":   [230, 190, 158, 130, 108],
}
LABEL_SIZE = 42


def row_hash(row_id, seed):
    h = hashlib.sha256(f"{seed}:{row_id}".encode()).hexdigest()
    return int(h[:12], 16)


def fmt(template, row):
    """Fill {col} placeholders from the row, with humane formatting."""
    vals = dict(row)
    if str(vals.get("minutes", "")).isdigit():
        vals["minutes"] = f"{int(vals['minutes']):,}"
    if not str(vals.get("name", "")).strip():
        vals["name"] = "FRIEND"          # empty-name fallback; QA records it
    return template.format(**vals)


def pick_font(text, chain):
    """First font covering `text`; falls back to the chain head (QA will flag)."""
    return first_covering(text, chain) or chain[0]


MAX_LINES = {"hook": 2, "minutes": 1, "artist": 3, "song": 3, "badge": 2}
LEADING = 0.95


def build(brief, row, seed=1729):
    cv = brief["canvas"]
    W, H = cv["width"], cv["height"]
    m = int(W * brief["safe_margin_pct"])
    inner_w = W - 2 * m

    h = row_hash(row["id"], seed)
    pal = brief["palettes"][h % len(brief["palettes"])]
    # Deterministic per-row motion variation: which side text enters from.
    swing = 1 if (h >> 8) % 2 else -1

    layers = [{
        "type": "solid", "name": "bg", "color": pal["bg"],
        "motion_blur": False,
    }]

    qa_notes = []

    for i, beat in enumerate(brief["beats"]):
        bid = beat["id"]
        start, dur = beat["start"], beat["duration"]
        label_txt = fmt(beat["label"], row)
        value_txt = fmt(beat["value"], row)

        label_font = pick_font(label_txt, brief["fonts"]["label"])
        value_font = pick_font(value_txt, brief["fonts"]["display"])

        ladder = SIZE_LADDER[bid]
        max_lines = MAX_LINES[bid]
        # Budget the value block a little under half the canvas so the label and
        # the rule always have room; the ladder shrinks the type to fit it.
        budget_h = int(H * 0.42)
        value_size, lines, fitted = fit_block(
            value_txt, value_font, inner_w, budget_h, ladder,
            leading=LEADING, tracking=-2, max_lines=max_lines,
        )
        if not fitted:
            qa_notes.append(
                f"{bid}: value overflows at min size {ladder[-1]} "
                f"({len(lines)} lines, max {max_lines})"
            )

        # Value block sits on the optical centre; label rides just above it.
        value_h = int(len(lines) * value_size * LEADING) + 20
        value_y = (H - value_h) // 2
        label_y = value_y - 90

        accent = pal["accent"] if i % 2 == 0 else pal["accent2"]

        # A rule under the label — gives every beat the same structural spine
        # so the piece reads as one system rather than five unrelated cards.
        layers.append({
            "type": "solid", "name": f"{bid}_rule", "color": accent,
            "box": [m, label_y + 62, 120, 6],
            "start": start, "duration": dur,
            "animate": {
                "scale": [
                    {"t": 0.0, "v": [0.0, 1.0], "ease": "outExpo"},
                    {"t": 0.55, "v": [1.0, 1.0]},
                ],
                "opacity": [
                    {"t": 0.0, "v": 0.0},
                    {"t": 0.15, "v": 1.0},
                    {"t": dur - 0.3, "v": 1.0},
                    {"t": dur, "v": 0.0},
                ],
            },
        })

        layers.append({
            "type": "text", "name": f"{bid}_label", "text": label_txt,
            "font": label_font, "size": LABEL_SIZE, "color": accent,
            "box": [m, label_y, inner_w, 60], "align": "left bottom",
            "tracking": 6, "shrink": True, "min_size": 24,
            "start": start, "duration": dur,
            "animate": {
                "opacity": [
                    {"t": 0.0, "v": 0.0},
                    {"t": 0.45, "v": 1.0, "ease": "outCubic"},
                    {"t": dur - 0.3, "v": 1.0},
                    {"t": dur, "v": 0.0},
                ],
                "position": [
                    {"t": 0.0, "v": [0, 26], "ease": "outCubic"},
                    {"t": 0.6, "v": [0, 0]},
                ],
            },
        })

        layers.append({
            "type": "text", "name": f"{bid}_value", "text": value_txt,
            "font": value_font, "size": value_size, "color": pal["ink"],
            "box": [m, value_y, inner_w, value_h], "align": "left top",
            "tracking": -2, "leading": LEADING, "breakline": True,
            "shrink": True, "min_size": max(24, ladder[-1] - 20),
            "start": start, "duration": dur,
            "animate": {
                "opacity": [
                    {"t": 0.0, "v": 0.0},
                    {"t": 0.5, "v": 1.0, "ease": "outCubic"},
                    {"t": dur - 0.35, "v": 1.0},
                    {"t": dur, "v": 0.0},
                ],
                "position": [
                    {"t": 0.0, "v": [40 * swing, 0], "ease": "outExpo"},
                    {"t": 0.75, "v": [0, 0]},
                ],
            },
        })

    total = brief["beats"][-1]["start"] + brief["beats"][-1]["duration"]
    scene = {
        "width": W, "height": H, "fps": cv["fps"],
        "duration": round(total, 3),
        "name": f"{brief['name']}_{row['id']}",
        "layers": layers,
    }
    return scene, qa_notes


def load_brief(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


if __name__ == "__main__":
    import csv
    import sys
    from pathlib import Path
    here = Path(__file__).resolve().parent
    brief = load_brief(sys.argv[1] if len(sys.argv) > 1 else here / "brief.json")
    with open(here / "data/audience.csv", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    sc, notes = build(brief, rows[0])
    print(json.dumps(sc, ensure_ascii=False)[:600], "...")
    print("qa_notes:", notes)
