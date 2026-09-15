# Final report: "a tweet that gets a lot of likes on AI"

Run as an (auto)² campaign: 15 experiments, 2 waves, 3 blind judges per evaluation (Opus, Sonnet,
Fable — fresh context, randomized position, no provenance), everything in `research/nodes.jsonl`.

## Result

Winner: **X-0015**, the self-demonstrating cartridge post (`research/deliverable/tweet.md`).

| | Mean Borda (of 13) | Ranks J1/J2/J3 | Would repost |
|---|---|---|---|
| Winner's lineage (H3) | 11.00 | 4, 3, 2 | 3/3 |
| Best standalone post (P-A4) | 11.33 | 3, 2, 3 | 2/3 |
| Track A default draft (anchor) | 0.00 | 14, 14, 14 | 0/3 |
| Track B default draft (anchor) | 1.33 | 13, 12, 13 | 0/3 |

Against the default drafts the gain is unambiguous: both anchors finished last with every judge,
and in wave 1 each candidate beat its baseline 3/3 (rubric 3.67 → 8.00 on track A, 6.33 → 8.00 on
track B; control paraphrase pair: 2/3, +0.33 rubric points, so the sweeps are outside noise).

Against the other finalists it is a coin flip. P-A4 leads H3 by 0.33 Borda points, which is inside
the noise this campaign measured; H3 is the only post in every judge's top four and the only
unanimous repost. Two defensible winners, different bets. The deliverable ships H3 because it is
the one that says something about the person posting it, and hands P-A4 over as the alternate.

## Recipe (the qualified changes that compose the winner)

1. **Drop the announcement frame.** "We built a way to…" lost to every rewrite of itself; all three
   judges named it unprompted (X-0005, X-0006, X-0008).
2. **Lead with the artifact proving itself.** "The image attached to this tweet *is* the thing"
   needs no trust and no click (X-0006).
3. **Put the mechanism second, in one sentence** — the IEND/FFD9 fact is the surprise that makes
   the first line survive scrutiny (X-0011, the qualified combination).
4. **Fix the claim to match the artifact**: JPEG/FFD9, not PNG/IEND, because a PNG uploaded to X is
   re-encoded and the payload dies (X-0015).

## Biggest levers

- **Voice, not topic.** The two anchors lost on cadence alone — em dashes, "the bottleneck isn't X,
  it's Y", nothing to argue with. Fixing that was worth more than any structural change tested.
- **Phrasing, not structure.** The planted paraphrase of a top-three post fell ~8 ranks with all
  three judges agreeing. Rewording beat every hybrid in effect size.
- **Proof in the timeline.** The one post that can be checked without leaving X was the only
  unanimous repost.

## Notable failures (do not retry without a new angle)

- **Stacking two hooks.** Four of five hybrids (H1, H4, H5, H6) ranked below a parent. One judge
  wrote the conclusion unprompted: "blending two hooks dilutes both." Adding a *supporting detail*
  to one hook still works — that is what the winner does.
- **Porting a winning format to different content.** H6 put the cartridge material into the
  then/now format that won track A and landed unanimously mid-pool (9, 9, 9). The format was never
  the lever.
- **Leading with the security angle.** P-B3 won its baseline by the smallest margin in its track and
  H5 (security beat inside the self-demo) ranked 5, 5, 11. Keep it as a closer at most.

## Harness changes made across waves

| Issue | Change | What it actually did |
|---|---|---|
| I-0001 ceiling: all 8 wave-1 candidates swept a weak parent, 5 saturated the rubric | C-0001: wave 2 uses a forced complete ranking, not pairwise-vs-parent | Worked. Produced the separation wave 1 could not, and the planted paraphrase turned the noise floor from a guess into a number |
| I-0002 cross-track scores incomparable (parents differed by 2.7 rubric points) | C-0002: one pool, both anchors included | Worked. Made picking a single deliverable possible at all |
| I-0003 judges praised numbers nobody measured | C-0003: builder may state a number only if checkable or syntactically hypothetical | Held. No wave-2 candidate invented a metric; the surviving figures are flagged in the deliverable |
| I-0004 all three judges volunteered a "best overall" the protocol never asked for | C-0004: made it a required JSON field | Worked, cheaply. It is how the winner's unanimity was visible at all |
| I-0005 baselines written by the same agent as the candidates | C-0005: anchors kept in the pool, confound reported not hidden | Did not fix anything. It is a stated limit, below |
| I-0006 the qualified winner told readers to save a PNG from X, which destroys the payload | C-0006: evidence worker re-reads every claim against the artifact and the platform before anything ships | Caught the defect. Six judge runs had scored that text without noticing |

## Limits of these claims

- **The final environment was never touched.** Every number here comes from LLM judges standing in
  for readers. Nothing was posted; no human saw these before you.
- **LLM judges score plausibility, not truth.** Demonstrated inside this campaign: six judge runs
  passed a post whose central instruction does not work on X, and when asked directly, one judge had
  the re-encoding direction backwards. Judges were used for taste and overruled on fact.
- **The baselines are self-authored strawmen** (I-0005). "Beats the default draft" means beats *my*
  default draft. The anchors finishing last says they are bad, not that the winner is good.
- **n = 3 judges, one panel.** Per-post spread was large (P-B2 ranked 1, 7 and 4). Differences under
  ~2 ranks, and the 0.33-point gap between the two finalists, are not real.
- **Likes were never modeled.** The rubric encodes 2026 ranking behavior (replies weighted far above
  likes, first-30-minute velocity, native media promoted, in-body links depressed) as *criteria*.
  That is a theory of engagement, not a measurement of it.
- **The winner's first sentence is a claim about a file surviving an upload pipeline.** It is true
  only if the round-trip check in the deliverable passes at post time. That check is the author's,
  and it cannot be run from here.
