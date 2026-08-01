# The video factory — harness

A brief plus a data feed goes in; N deterministic, QA-gated video variants come
out. This is the harness the gauntlet loop needs before it can run — the thing
that turns "our output is good" from an opinion into something a blind critic
can be handed.

## Run it

```bash
python3 make_data.py -n 500                     # regenerate the sample feed
python3 factory.py --rows 500 --frames 6 --verify-determinism
python3 progress.py                             # -> out/progress.html
```

`out/metrics.json` is the machine-readable result; `out/progress.html` is the
phone-readable one. Both label degraded runs explicitly.

## What each piece does

| File | Job |
|---|---|
| `brief.json` | The brief. Canvas, palettes, font fallback chains, and five beats whose text is `{column}` templates against the feed. Authoring a new video means editing this, not the code. |
| `make_data.py` | Generates `data/audience.csv`. Deterministic, and seeded with eight rows engineered to break naive layout — long names, diacritics, CJK, Arabic, emoji, an empty name, a 2-character name. |
| `scene.py` | `(brief, row, seed) -> scene dict`. Pure function. Picks the first font in each role's chain that actually covers the string, then walks a size ladder until the wrapped text fits its box. |
| `fontcov.py` | Hand-rolled TrueType reader: cmap for glyph coverage, hmtx for real advance widths. No fontTools here, and a character-count guess is not good enough to catch overflow. |
| `qa.py` | The gate: glyph coverage, title-safe, overflow at minimum shrink size, empty text, contrast. Every variant, not a sample. |
| `factory.py` | Batch driver. Builds, compiles via `strata compile`, QA-gates, samples stills, writes metrics. |
| `progress.py` | `metrics.json -> progress.html`, images inlined so it is one self-contained file. |
| `bar/` | The bar the output is judged against. `targets.md` is a draft; `bar/reference/` is empty and waiting for frames. |

## Measured on this machine

500 variants, `--verify-determinism`, no credentials:

- 500 variants compiled in ~65 s (~460/min), compile p95 ~140 ms
- 496/500 pass the QA gate
- the 4 failures are real: three rows contain simplified Chinese, Arabic and
  emoji, and no font on this machine covers them. Shipping Noto CJK / Noto
  Arabic / an emoji face and adding them to the chains in `brief.json` fixes it.
  Rendering them as silent tofu is exactly what the gate exists to prevent.

## What is NOT measured, and why

**There are no rendered frames.** `strata render` and `strata snapshot` need
Idomoo credentials. None are present:

```
$ strata auth status --json
{"error":"Not authenticated. Run `strata auth login` or set
IDOMOO_ACCOUNT_ID / IDOMOO_SECRET_KEY."}
```

The Idomoo MCP is also unauthenticated (*401 session expired*), and
`strata auth login` needs a TTY this environment does not have.

So the frame step falls back to `strata preview`, which draws **wireframes** —
box outlines and safe-area guides, no type, no colour, no motion. Layout
geometry is real; design quality is not visible at all. Every degraded run says
so in stdout, in `metrics.json` (`frames_are_renders: false`), and in a banner
on the progress page.

Consequence: **the blind A/B cannot run.** A critic handed a wireframe and a
Spotify Wrapped still is grading a blue rectangle against a piece of design.

## To make the loop runnable

1. **Credentials** — `IDOMOO_ACCOUNT_ID` and `IDOMOO_SECRET_KEY` in the
   environment (or a working `strata auth login`). Then `--backend cloud` and
   the stills become renders. This is the blocker; nothing else unblocks it.
2. **Reference frames** in `bar/reference/`, named per that directory's README
   so pairs match by beat.
3. **Fonts** covering the scripts in the feed, if the real feed has them.

With 1 and 2 in place, the loop has an artifact, a bar, and a critic that looks
at pictures. Without them it is a builder writing scene JSON that nobody can
see.
