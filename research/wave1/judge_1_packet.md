# Blind evaluation packet

You are judging candidate posts for X (Twitter), aimed at the AI / developer side of the
platform. You do not know who wrote them or which is the incumbent. Judge only the text.

Assume: each post is a single standalone post by an account with a normal following, no
thread, no link in the body. If a post refers to an attached image, assume a normal-looking
image is attached. All posts are within the 280-character budget.

## Rubric (score each post 0-8: one point per criterion met)
1. Hook: the first ~8 words alone would stop a scroll.
2. Concrete: contains a specific checkable thing (number, named tool, mechanism), not a vibe.
3. Payoff: the reader finishes knowing or feeling something new.
4. Reply pull: gives people something to argue with, complete, or ask about.
5. Low friction: self-contained, no hashtags, no link dependency, no thread dependency.
6. Human voice: reads like a person typed it; no LLM tells, no marketing cadence.
7. Defensible: nothing in it looks invented or likely to get fact-checked into a ratio.
8. Identity: sharing it flatters the sharer (in-group knowledge, taste, being early).

## For EACH pair below, output an object with:
  pair, a_points, b_points, prefer ("A" or "B"), likes_ratio (your estimate of how many
  times more likes the preferred one gets, e.g. 1.0 = identical, 3.0 = triple), why (<=25 words).

Judge each pair independently. It is fine to prefer the one with fewer rubric points if you
genuinely think it gets more likes; say so in `why`. Do not assume the longer or more
technical one is better. Be a harsh, taste-driven AI-Twitter reader, not a rubric robot.

## Output
Write ONLY a JSON array of 9 objects to the output path you were given. No prose.

---

### pair1

**Post A**
```
AI agents are getting really good at coding, but the bottleneck isn't the model anymore — it's context. The teams winning right now are the ones who figured out what to put in the window, not which model to call.
```

**Post B**
```
Every AI company is shipping agents and every agent is the same three parts: a loop, a tool list, and a prompt someone rewrote 40 times at 2am. The moat was never the architecture. It's the 40 rewrites.
```

### pair2

**Post A**
```
AI agents are getting really good at coding, but the bottleneck isn't the model anymore — it's context. The teams winning right now are the ones who figured out what to put in the window, not which model to call.
```

**Post B**
```
The fastest way to make an agent smarter is still deleting things. Tools it never calls. Instructions it can't follow. Context it doesn't read. Everyone is busy picking a model; the wins are sitting in the menu.
```

### pair3

**Post A**
```
We built a way to share Claude Code skills as images. A PNG with a SKILL.md appended after the IEND marker still renders everywhere, but you can extract the bytes and install the skill. One file is the demo and the payload.
```

**Post B**
```
The image attached to this tweet is a working Claude Code skill.

Not a screenshot of one. The file. Append SKILL.md after the JPEG's end-of-image marker and it rides along: renders fine, extracts in 4 lines, installs in one.
```

### pair4

**Post A**
```
We built a way to share Claude Code skills as images. A PNG with a SKILL.md appended after the IEND marker still renders everywhere, but you can extract the bytes and install the skill. One file is the demo and the payload.
```

**Post B**
```
Shipping Claude Code skills the way games shipped in 1994: one file, no installer, the art on the box is part of the product.

It's a JPEG. The skill is appended after the end-of-image marker. Save the picture, extract the tail, drop it in ~/.claude/skills.
```

### pair5

**Post A**
```
A PNG stops decoding at its IEND marker. Anything you append after it is invisible to every image viewer and perfectly readable to everything else.

So we ship Claude Code skills as pictures now. The image is the demo, the tail bytes are the skill.
```

**Post B**
```
We built a way to share Claude Code skills as images. A PNG with a SKILL.md appended after the IEND marker still renders everywhere, but you can extract the bytes and install the skill. One file is the demo and the payload.
```

### pair6

**Post A**
```
AI agents are getting really good at coding, but the bottleneck isn't the model anymore — it's context. The teams winning right now are the ones who figured out what to put in the window, not which model to call.
```

**Post B**
```
AI agents have gotten really good at coding, but the model stopped being the bottleneck a while ago — context is. The teams winning right now worked out what to put in the window, not which model to call.
```

### pair7

**Post A**
```
An image can carry an agent skill. Append a SKILL.md after a PNG's end marker: renders normally in every viewer, extracts in four lines, installs in one.

Nothing is hidden, the bytes are right there in the file. Read what you install anyway.
```

**Post B**
```
We built a way to share Claude Code skills as images. A PNG with a SKILL.md appended after the IEND marker still renders everywhere, but you can extract the bytes and install the skill. One file is the demo and the payload.
```

### pair8

**Post A**
```
AI agents are getting really good at coding, but the bottleneck isn't the model anymore — it's context. The teams winning right now are the ones who figured out what to put in the window, not which model to call.
```

**Post B**
```
2023: prompt engineering isn't a real job
2026: your company's entire output quality is one markdown file that nobody is allowed to edit
```

### pair9

**Post A**
```
AI agents are getting really good at coding, but the bottleneck isn't the model anymore — it's context. The teams winning right now are the ones who figured out what to put in the window, not which model to call.
```

**Post B**
```
Nobody's agent is failing because the model is too dumb. It's failing because you handed it 40 tools, 9,000 tokens of instructions, and no way to tell which ones matter. It's a skill issue and the skill is yours.
```
