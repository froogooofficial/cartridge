# Blind evaluation: one pair

Two versions of a post for X (Twitter), aimed at AI/dev Twitter. Assume each is a single
standalone post with a normal-looking image attached, no thread, no link in the body.
You do not know which came first.

Question: which gets more likes? Judge hook, payoff, voice, reply pull, and whether anything
in it looks wrong enough to get fact-checked in the replies.

**Post A**
```
The image attached to this tweet is a working Claude Code skill.

A JPEG stops decoding at its FFD9 end marker. Everything after it is invisible to every viewer and perfectly readable to everything else. That's where the SKILL.md is. Save it, read the tail.
```

**Post B**
```
The image attached to this tweet is a working Claude Code skill.

A PNG stops decoding at its IEND marker. Everything after it is invisible to every viewer and perfectly readable to everything else. That's where the SKILL.md is. Save it, read the tail.
```

Output ONLY this JSON to the path you were given:
{"prefer":"A"|"B","likes_ratio":float,"why":"<=25 words","factual_risk":"A"|"B"|"neither","risk_why":"<=20 words"}
