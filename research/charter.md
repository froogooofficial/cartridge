# Campaign charter: "AI tweet that gets a lot of likes"

## Objective
Produce one X/Twitter post, aimed at the AI/dev side of X, that maximizes expected
likes (and the engagement that drives reach to likes) over a competent default draft.

## Score
- Metric: **judge preference share** — fraction of independent blind judges that pick the
  candidate over its parent in a paired A/B comparison. Higher is better.
- Secondary metric: **rubric points** (0-8, see below), mean over judges.
- How computed: 3 independent judge agents, fresh context, no provenance, candidate and
  parent presented as A/B in randomized order, judges also asked for a like-count estimate.
- Baseline: the wave-0 default draft (E-0001 / `research/wave1/baseline.md`), by definition 0.50.
- Noise floor: measured in-wave with two controls — (a) parent vs. a trivial paraphrase of
  the parent, (b) position swap. Minimum meaningful gain: candidate must win **3/3 judges**,
  or 2/3 with a rubric-point gain larger than the control pair's spread.

## Rubric (each criterion is pass/fail, 1 point each)
1. **Hook**: the first ~8 words alone would stop a scroll (no throat-clearing, no "I've been thinking about").
2. **Concrete**: contains a specific, checkable thing — a number, a named tool, a mechanism — not a vibe.
3. **Payoff**: a reader finishes it knowing or feeling something they didn't 6 seconds ago.
4. **Reply pull**: gives people something to argue with, complete, or ask about (replies are the
   heaviest-weighted signal in the 2026 ranking, and reply velocity is what drags likes up).
5. **Low friction**: ≤280 chars, no link in the body, no hashtags, no "thread below 🧵" dependency,
   self-contained if seen alone on a timeline.
6. **Human voice**: reads like a person typed it. No 🚀, no "Here's why:", no listicle cadence,
   no LLM tells (rule of three, "not X, but Y" stacking, hedge-everything qualifiers).
7. **Defensible**: every factual claim is true of the actual artifact. No invented benchmarks,
   no fake metrics. (A tweet that gets ratio'd for lying is a negative-likes outcome.)
8. **Identity**: sharing it says something flattering about the sharer (in-group knowledge,
   taste, being early).

## Budget per experiment
One post. ≤280 characters. At most one attached image or short video. No link in the body
(links are algorithmically depressed in 2026; the link goes in a reply if at all).
Charged identically to every candidate — a candidate may not win by being a thread.

## Environments
- Search: blind LLM judges standing in for seeds. This is a **proxy**; it predicts human
  taste imperfectly and is biased toward things that read well in isolation.
- Final: the real timeline. Not available inside this campaign. Every claim below is a
  proxy claim, and the report says so.

## Permissions
- May change: topic, angle, format, voice, structure, length, whether media is attached,
  and may add new components (e.g. a reply-bait second line, an image payload).
- May NOT change: the rubric, the judge protocol, the 280-char budget, or the requirement
  that claims be true.

## Campaign shape
- Tracks:
  - **A — Open AI-topic post**: an opinion/observation post about AI, no product attached.
  - **B — Cartridge demo post**: a post that shows off this repo's trick (a skill hidden in
    an image you can tweet). Inherently demo-able and native to AI Twitter.
- Wave length: wave 1 = 8 experiments (4 per track), wave 2 = combination + refinement.
- Stop when: 2 waves complete, or a wave produces no qualified gain.
- Human checkpoints: at each wave boundary (reported to the user).

## Sources of ground truth for the rubric (2026 X ranking behavior)
- Replies weighted far above likes; first-30-minute velocity gates amplification.
- Grok-transformer ranking (Phoenix out-of-network retrieval) scores "interesting to humans"
  semantically, so keyword/hashtag games are dead.
- Native media promoted; external links in-body severely depressed.
