# Blind ranking packet

You are one of three independent judges. You are ranking candidate posts for X (Twitter),
aimed at the AI / developer side of the platform. You do not know who wrote them, which are
new, or which are incumbents. Judge only the text.

Assume: each is a single standalone post from an account with a normal following. No thread,
no link in the body. If a post refers to an attached image, assume a normal-looking image is
attached. All posts are within the 280-character budget, so length is not itself a violation.

## The question
Which of these gets the most likes on AI/dev Twitter? Not which is most correct, most useful,
or best written. Most liked.

## Reference criteria (context for your judgment, not a checklist to total up)
Hook in the first ~8 words. Something concrete and checkable. A payoff. Something to reply to
or argue with. Self-contained, no hashtags or link dependency. Human voice, no marketing or
LLM cadence. Nothing that looks invented and could get fact-checked into a ratio. Sharing it
should flatter the sharer.

## Task
Rank ALL posts from best to worst. No ties. Then answer the extra fields.

## Output
Write ONLY this JSON object to the output path you were given:
{
  "ranking": ["P7", "P2", ...],            // every label exactly once, best first
  "best_overall": "P7",
  "why_best": "<= 30 words",
  "why_second": "<= 25 words",
  "worst": "P3",
  "why_worst": "<= 20 words",
  "would_repost": ["P7", "P2"],            // the ones you would personally repost, 0 to 3 of them
  "notes": "<= 40 words, anything that surprised you"
}

---

### P1
```
Every AI company is shipping agents and every agent is the same three parts: a loop, a tool list, and a prompt someone rewrote 40 times at 2am. The moat was never the architecture. It's the 40 rewrites.
```

### P2
```
The image attached to this tweet is a working Claude Code skill.

Not a screenshot of one. The file. Append SKILL.md after the JPEG's end-of-image marker and it rides along: renders fine, extracts in 4 lines, installs in one.
```

### P3
```
1994: the game came on a cartridge with the art on the front
2026: the agent skill comes appended to a JPEG and the picture is the documentation

the image on this post is one of them. save it and read the tail bytes.
```

### P4
```
The image attached to this tweet is a working Claude Code skill.

A PNG stops decoding at its IEND marker. Everything after it is invisible to every viewer and perfectly readable to everything else. That's where the SKILL.md is. Save it, read the tail.
```

### P5
```
The image attached to this tweet is a working Claude Code skill. Not a screenshot. The file.

SKILL.md appended after the end-of-image marker: renders anywhere, extracts in four lines, installs in one.

Nothing is hidden. Read what you install anyway.
```

### P6
```
Shipping Claude Code skills the way games shipped in 1994: one file, no installer, the art on the box is part of the product.

It's a JPEG. The skill is appended after the end-of-image marker. Save the picture, extract the tail, drop it in ~/.claude/skills.
```

### P7
```
Nobody's agent is failing because the model is too dumb. It's failing because you handed it 40 tools, 9,000 tokens of instructions, and no way to tell which ones matter. It's a skill issue and the skill is yours.
```

### P8
```
2023: prompt engineering isn't a real job
2026: your company's entire output quality is one markdown file that nobody is allowed to edit
```

### P9
```
We built a way to share Claude Code skills as images. A PNG with a SKILL.md appended after the IEND marker still renders everywhere, but you can extract the bytes and install the skill. One file is the demo and the payload.
```

### P10
```
2023: prompt engineering isn't a real job
2026: the moat is one markdown file somebody rewrote 40 times at 2am and nobody else is allowed to touch
```

### P11
```
2023: prompt engineering is not a real career
2026: everything your company ships is downstream of one markdown file no one else may touch
```

### P12
```
2023: prompt engineering isn't a real job
2026: you gave it 40 tools, 9,000 tokens of instructions, and no way to tell which ones matter, and you're blaming the model

skill issue. the skill is yours.
```

### P13
```
AI agents are getting really good at coding, but the bottleneck isn't the model anymore — it's context. The teams winning right now are the ones who figured out what to put in the window, not which model to call.
```

### P14
```
The image attached to this tweet is a working Claude Code skill. Not a screenshot of one. The file.

Skills ship like 1994 games now: one file, no installer, the art is on the box. SKILL.md sits after the end-of-image marker. Save the picture, read the tail.
```
