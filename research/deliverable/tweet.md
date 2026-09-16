# Deliverable

## Ship this (primary)

> The image attached to this tweet is a working Claude Code skill.
>
> A JPEG stops decoding at its FFD9 end marker. Everything after it is invisible to every viewer
> and perfectly readable to everything else. That's where the SKILL.md is. Save it, read the tail.

257 characters. Attach `research/deliverable/tweet_cartridge.jfif` (220 KiB, `test.jfif` carrier
with this repo's `SKILL.md` appended after the EOI marker; extraction verified byte-for-byte
locally).

**Do this before you trust the first sentence.** Post it, download the image X actually serves back,
and run the extractor on the downloaded copy. If the payload survived, the post is true and the
replies will prove it themselves. If X re-encoded it, do not leave the post up as written — use the
fallback below and put the original file behind a link in the first reply.

Fallback if the round-trip fails:

> This picture is a Claude Code skill.
>
> A JPEG stops decoding at its FFD9 end marker. Everything after it is invisible to every viewer and
> perfectly readable to everything else. That's where the SKILL.md lives — until X re-encodes it.
> Untouched copy in the reply.

No link in the body either way (in-body links are heavily depressed in the 2026 ranking). The repo
link goes in your first reply, which also gives the post its first reply.

## Alternate, if you want a post with no product attached

> 2023: prompt engineering isn't a real job
> 2026: your company's entire output quality is one markdown file that nobody is allowed to edit

136 characters. Highest-scoring post in the campaign on raw judge preference (top three for all
three judges, two of three would repost it). It is also a joke anyone could post — it says nothing
about you or your work. That is the whole trade.

## Runners-up, kept because they are genuinely different bets

- Self-demo, no mechanism (parent of the winner, ranked first by one judge, seventh by another):
  *"The image attached to this tweet is a working Claude Code skill. Not a screenshot of one. The
  file. Append SKILL.md after the JPEG's end-of-image marker and it rides along: renders fine,
  extracts in 4 lines, installs in one."*
- Reply-bait take, no product: *"Nobody's agent is failing because the model is too dumb. It's
  failing because you handed it 40 tools, 9,000 tokens of instructions, and no way to tell which
  ones matter. It's a skill issue and the skill is yours."* (ranked first by one judge, tenth by
  another — the most polarizing post in the pool, which is not the same as the best one)

## One author-facing check

The "40 tools, 9,000 tokens" figures in that last one are second-person hypotheticals, not a
measurement anyone made. That is deliberate (see I-0003). If you post it, do not let a reply turn
it into a claimed benchmark.
