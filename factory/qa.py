#!/usr/bin/env python3
"""Per-variant quality gate. Everything here is measured, not eyeballed.

These are the checks that decide the "layout failures across a full batch"
number. A variant either passes all of them or it is a failure — there is no
partial credit, because a viewer who gets the one broken video does not care
that the other 499 were fine.
"""
from fontcov import measure, missing

SEVERITY = {"glyph": "fail", "overflow": "fail", "safe_area": "fail",
            "empty_text": "fail", "contrast": "warn", "compile": "fail"}


def _hex_to_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _luminance(rgb):
    def chan(c):
        c /= 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (chan(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg, bg):
    l1, l2 = sorted((_luminance(_hex_to_rgb(fg)), _luminance(_hex_to_rgb(bg))))
    return (l2 + 0.05) / (l1 + 0.05)


def check_scene(scene, brief, build_notes):
    """Returns a list of issue dicts. Empty list == variant passes."""
    issues = []
    W, H = scene["width"], scene["height"]
    m = int(W * brief["safe_margin_pct"])
    safe = (m, m, W - m, H - m)

    # Every text layer in this template sits directly on the page background —
    # the accent solids are rules and never sit behind type. If a future
    # template puts text on a panel, this needs to resolve the panel under the
    # text box rather than assuming the page colour.
    page_bg = next((ly.get("color") for ly in scene["layers"]
                    if ly.get("name") == "bg"), "#000000")

    for note in build_notes:
        issues.append({"check": "overflow", "severity": "fail", "detail": note})

    for ly in scene["layers"]:
        if ly.get("type") != "text":
            continue
        name, text = ly["name"], ly.get("text", "")

        if not text.strip():
            issues.append({"check": "empty_text", "severity": "fail",
                           "layer": name, "detail": "empty string"})
            continue

        miss = missing(text, ly["font"])
        if miss:
            issues.append({
                "check": "glyph", "severity": "fail", "layer": name,
                "detail": "font lacks " + " ".join(f"U+{c:04X}" for c in miss),
                "font": ly["font"].split("/")[-1], "text": text,
            })

        box = ly.get("box")
        if box:
            x, y, w, h = box
            if x < safe[0] or y < safe[1] or x + w > safe[2] or y + h > safe[3]:
                issues.append({
                    "check": "safe_area", "severity": "fail", "layer": name,
                    "detail": f"box {box} exits title-safe {list(safe)}",
                })
            # Single-line width sanity, independent of the builder's own maths.
            # A shrink layer is judged at its floor: the engine will scale type
            # down to min_size, so only an overflow that survives min_size is a
            # real failure.
            if not ly.get("breakline"):
                eff = ly.get("min_size") if ly.get("shrink") else None
                eff = eff or ly.get("size", 48)
                if measure(text, ly["font"], eff, ly.get("tracking", 0)) > w:
                    issues.append({
                        "check": "overflow", "severity": "fail", "layer": name,
                        "detail": f"single-line text exceeds box width at "
                                  f"{eff}px with no breakline",
                    })

        fg = ly.get("color")
        if fg:
            ratio = contrast_ratio(fg, page_bg)
            if ratio < 4.5:
                issues.append({
                    "check": "contrast", "severity": "warn", "layer": name,
                    "detail": f"{fg} on {page_bg} is {ratio:.2f}:1 (want >=4.5)",
                })

    return issues


def summarise(all_issues):
    """Roll per-variant issue lists into the batch numbers."""
    fails = warns = 0
    by_check = {}
    for issues in all_issues:
        variant_failed = False
        for i in issues:
            by_check[i["check"]] = by_check.get(i["check"], 0) + 1
            if i["severity"] == "fail":
                variant_failed = True
        if variant_failed:
            fails += 1
        elif issues:
            warns += 1
    return {"variants_failed": fails, "variants_warned": warns,
            "issues_by_check": by_check}
