# The bar

**Status: DRAFT — the numbers below are my proposals, not your decisions.**
Correct them before the loop runs; they are what "pass" means, so they should be
yours. The reference frames this file refers to are not here yet — see
[reference/README.md](reference/README.md).

---

## 1. The frame test (the one that actually gates)

A blind viewer is shown two unlabelled stills at a matched timestamp — one from
`bar/reference/`, one from our batch — and asked which is the better piece of
design. Nothing else about either is disclosed.

**Pass:** our frame is picked at least as often as the reference, across every
matched pair, by three independent critics with clean context.

Notes on how this has to be run or it means nothing:

- **Matched timestamps.** A reveal beat is compared against a reveal beat, not
  against whatever frame happened to get grabbed. Pairing is by beat role, which
  is why reference frames need the naming convention in `reference/README.md`.
- **The critic sees images, never prose.** No scene JSON, no description of what
  we intended, no builder reasoning. If the critic is reading text, the test has
  already failed.
- **Renders only.** A `strata preview` wireframe is not admissible. Until
  credentials exist this test cannot be run at all — see the blocker note below.
- **Losing is the normal outcome early.** The output of a loss is one sentence
  naming the single biggest gap, which becomes the next build task.

## 2. Batch numbers

| Target | Proposed | Measured today | Where it comes from |
|---|---|---|---|
| Variants per batch | 500 (then 10k) | **500** | `metrics.variants` |
| Layout failures | **0** unrenderable, 0 overflow, 0 tofu | 4 / 500 | `metrics.qa` |
| Reproducible rebuild | 100% payload-identical | see `metrics.determinism` | two independent passes |
| Scene build + compile, p95 | < 500 ms/variant | ~140 ms | `metrics.compile_ms.p95` |
| Cloud render, p95 | < 90 s/variant | **not measured** | needs credentials |
| Batch throughput | > 300 variants/min (compile) | ~460/min | `metrics.variants_per_min` |

The four current failures are real and are not layout bugs: three rows
(simplified Chinese, Arabic, emoji) have no font on this machine that covers
their glyphs, and one is a knock-on. Fixing them means shipping Noto CJK / Noto
Arabic / an emoji face and adding them to the fallback chains in `brief.json` —
at which point the target is 0 and it is meetable. Leaving them as a silent
tofu render is the failure mode this whole gate exists to prevent.

## 3. What "brand-safe" has to mean to count

Every one of these is checked on every variant, not sampled:

- Every glyph in every string exists in the font that will render it.
- No text box leaves the title-safe area.
- No string overflows its box at its minimum shrink size.
- No empty text layer (an empty feed field must hit a designed fallback, not a
  blank frame).
- Text/background contrast ≥ 4.5:1.

A variant that fails any of these is a failed variant. There is no partial
credit — the person who receives the one broken video does not care that the
other 499 were fine.

---

## Blocker

Targets 1 and the render row of table 2 cannot be measured in this environment.
`strata render` and `strata snapshot` both need Idomoo credentials, and none are
present (`strata auth status` → *not authenticated*; the Idomoo MCP returns
*401 session expired*). Without them the only local still is a wireframe, which
shows layout geometry and nothing about design quality.

So the frame test — the gate that decides whether any of this beats Wrapped —
is currently unrunnable, and no amount of iteration changes that. Credentials
and reference frames are the two inputs that turn this from a batch harness into
the loop you asked for.
