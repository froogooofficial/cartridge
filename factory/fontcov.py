#!/usr/bin/env python3
"""Minimal TrueType reader: glyph coverage + real text measurement. stdlib only.

Why this exists. The two ways a personalised video factory ships garbage at
scale are tofu and overflow, and neither is visible in a spot check:

  * Tofu — the template is approved against "Sarah Jones"; the feed contains
    "Zoë Ødegård" and "李伟", and 4% of the batch renders empty boxes. The only
    way to catch it is to test every string in the feed against the font's cmap
    before render.
  * Overflow — the template is approved against a 11-character name; the feed
    contains "Bartholomew Fitzgerald-Wintersmith III" and it runs off the frame
    or auto-shrinks to unreadable. Catching that needs the font's actual advance
    widths, not a characters-times-size guess.

So this parses cmap (formats 4 and 12) for coverage and hmtx/hhea/head for
measurement. That covers effectively every .ttf/.otf you will be handed.
No fontTools in this environment, hence the hand-rolled structs.
"""
import struct
from functools import lru_cache


# ---------------------------------------------------------------- table dir

def _tables(buf):
    if buf[:4] == b"ttcf":
        (num,) = struct.unpack_from(">I", buf, 8)
        if not num:
            raise ValueError("empty ttc")
        (base,) = struct.unpack_from(">I", buf, 12)
    else:
        base = 0
    (num_tables,) = struct.unpack_from(">H", buf, base + 4)
    out = {}
    for i in range(num_tables):
        rec = base + 12 + 16 * i
        tag = buf[rec:rec + 4]
        off, length = struct.unpack_from(">II", buf, rec + 8)
        out[tag] = (off, length)
    return out


# ---------------------------------------------------------------- cmap

def _cmap4(buf, off, out):
    (seg_x2,) = struct.unpack_from(">H", buf, off + 6)
    seg = seg_x2 // 2
    ends = struct.unpack_from(f">{seg}H", buf, off + 14)
    starts = struct.unpack_from(f">{seg}H", buf, off + 16 + seg_x2)
    deltas = struct.unpack_from(f">{seg}h", buf, off + 16 + 2 * seg_x2)
    ro_pos = off + 16 + 3 * seg_x2
    range_offs = struct.unpack_from(f">{seg}H", buf, ro_pos)

    for i in range(seg):
        start, end = starts[i], ends[i]
        if start > end or start == 0xFFFF:
            continue
        for cp in range(start, min(end, 0xFFFE) + 1):
            if range_offs[i] == 0:
                gid = (cp + deltas[i]) & 0xFFFF
            else:
                pos = ro_pos + 2 * i + range_offs[i] + 2 * (cp - start)
                if pos + 2 > len(buf):
                    continue
                (gid,) = struct.unpack_from(">H", buf, pos)
                if gid:
                    gid = (gid + deltas[i]) & 0xFFFF
            if gid:
                out.setdefault(cp, gid)


def _cmap12(buf, off, out):
    (n_groups,) = struct.unpack_from(">I", buf, off + 12)
    for i in range(n_groups):
        s, e, gid = struct.unpack_from(">III", buf, off + 16 + 12 * i)
        if not gid or e - s > 0x20000:
            continue
        for k, cp in enumerate(range(s, e + 1)):
            out.setdefault(cp, gid + k)


@lru_cache(maxsize=64)
def _font(font_path):
    """Parse once: {cmap: {cp: gid}, adv: [advance widths], upem: int}."""
    with open(font_path, "rb") as fh:
        buf = fh.read()
    tabs = _tables(buf)
    if b"cmap" not in tabs:
        raise ValueError(f"{font_path}: no cmap table")

    cmap = {}
    c_off = tabs[b"cmap"][0]
    (n_sub,) = struct.unpack_from(">H", buf, c_off + 2)
    subtables = []
    for i in range(n_sub):
        pid, eid, sub = struct.unpack_from(">HHI", buf, c_off + 4 + 8 * i)
        subtables.append((pid, eid, c_off + sub))
    # Prefer the widest-coverage unicode subtables; format 12 first.
    subtables.sort(key=lambda t: 0 if (t[0], t[1]) in ((3, 10), (0, 4), (0, 6)) else 1)
    for _pid, _eid, off in subtables:
        try:
            (fmt,) = struct.unpack_from(">H", buf, off)
            if fmt == 4:
                _cmap4(buf, off, cmap)
            elif fmt == 12:
                _cmap12(buf, off, cmap)
        except (struct.error, IndexError):
            continue

    upem = 1000
    if b"head" in tabs:
        (upem,) = struct.unpack_from(">H", buf, tabs[b"head"][0] + 18)
        upem = upem or 1000

    adv = []
    if b"hhea" in tabs and b"hmtx" in tabs:
        (n_metrics,) = struct.unpack_from(">H", buf, tabs[b"hhea"][0] + 34)
        h_off = tabs[b"hmtx"][0]
        for i in range(n_metrics):
            try:
                (a,) = struct.unpack_from(">H", buf, h_off + 4 * i)
            except struct.error:
                break
            adv.append(a)

    return {"cmap": cmap, "adv": adv, "upem": upem}


# ---------------------------------------------------------------- public API

def coverage(font_path):
    """Set of codepoints the font can render."""
    return set(_font(font_path)["cmap"].keys())


def missing(text, font_path):
    """Codepoints in `text` the font cannot render, ignoring whitespace."""
    cov = _font(font_path)["cmap"]
    return sorted({ord(c) for c in text if not c.isspace() and ord(c) not in cov})


def measure(text, font_path, size, tracking=0.0):
    """Advance width of `text` in pixels at `size` px. Missing glyphs count as 0.

    Ignores kerning and shaping (no GPOS/GSUB), so it is a close lower bound for
    Latin — good enough to catch overflow, which is what it is for.
    """
    f = _font(font_path)
    cmap, adv, upem = f["cmap"], f["adv"], f["upem"]
    if not adv:
        return len(text) * size * 0.5
    total = 0
    for ch in text:
        gid = cmap.get(ord(ch))
        if gid is None:
            continue
        total += adv[gid] if gid < len(adv) else adv[-1]
    return total * size / upem + max(0, len(text) - 1) * tracking


def wrap(text, font_path, size, box_w, tracking=0.0):
    """Greedy word wrap at `box_w`. Returns the list of lines.

    A word longer than the box is left on its own line and will report wider
    than the box, which is what callers want — that is a real overflow, not
    something to hide by breaking mid-word.
    """
    words = text.split()
    if not words:
        return [""]
    lines, cur = [], words[0]
    for w in words[1:]:
        trial = f"{cur} {w}"
        if measure(trial, font_path, size, tracking) <= box_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def fit_block(text, font_path, box_w, box_h, ladder, leading=1.0, tracking=0.0,
              max_lines=None):
    """Largest size on `ladder` at which the wrapped text fits box_w x box_h.

    Returns (size, lines, fitted). `fitted` is False when even the smallest size
    on the ladder overflows — the caller should treat that as a layout failure,
    not round it down and ship it.
    """
    last = (ladder[-1], [text], False)
    for size in ladder:
        lines = wrap(text, font_path, size, box_w, tracking)
        widest = max(measure(ln, font_path, size, tracking) for ln in lines)
        height = len(lines) * size * leading
        over_lines = max_lines is not None and len(lines) > max_lines
        if widest <= box_w and height <= box_h and not over_lines:
            return size, lines, True
        last = (size, lines, False)
    return last[0], last[1], False


def first_covering(text, font_paths):
    """First font in `font_paths` with full coverage of `text`, else None."""
    for p in font_paths:
        try:
            if not missing(text, p):
                return p
        except (OSError, ValueError, struct.error):
            continue
    return None


if __name__ == "__main__":
    import sys
    font = sys.argv[1]
    for s in sys.argv[2:]:
        m = missing(s, font)
        w = measure(s, font, 100)
        flag = "MISSING " + " ".join(f"U+{c:04X}" for c in m) if m else "ok"
        print(f"{s!r}: {flag}  width@100px={w:.0f}")
