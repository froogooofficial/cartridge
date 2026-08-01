# Reference frames go here

This directory is empty on purpose. The frames are the bar, and I should not be
the one choosing them — a bar I picked and then graded myself is not a bar.

## What to drop in

Stills from the two references named in the brief:

- **Spotify Wrapped** — the personalised-recap reference. The thing to beat.
- **A ManvsMachine reel** — the craft reference: type, motion, restraint.

Six to ten frames total is plenty. More matters less than picking the right
ones.

## Naming

The harness pairs our frame against a reference frame **by beat role**, so a
reveal is judged against a reveal rather than against whatever frame happened to
get grabbed. Name each file:

```
<source>__<beat>__<nn>.png
```

`<beat>` must be one of the beat ids in `factory/brief.json` — currently
`hook`, `minutes`, `artist`, `song`, `badge`.

```
wrapped__minutes__01.png      a big-number frame
wrapped__artist__01.png       the #1 artist reveal
wrapped__badge__01.png        the "top 0.5%" badge
mvm__hook__01.png             a title/opening frame
mvm__artist__01.png           a typographic reveal
```

If a reference has no equivalent for one of our beats, skip it — an unmatched
pair is worse than one fewer pair.

## Provenance

These are copyrighted frames used as a private grading reference. Keep them out
of anything published, and keep them out of any artifact or page that gets a
public URL. The pass/fail verdict can be published; the reference stills cannot.

## Why I did not fetch them myself

Scraping stills from Spotify's and ManvsMachine's published work and committing
them to a repo is your call, not mine — both on the copyright question and on
which frames genuinely represent the bar. You named the references; you should
pick the frames.
