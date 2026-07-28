# The bar — codified

**Provenance.** `apple.com/iphone` and `linear.app` are blocked by this environment's
egress policy (403 at the proxy, on curl and on WebFetch). `developer.apple.com`
returns only a JavaScript shell whose data host `docs.developer.apple.com` is also
blocked. **No reference capture was possible.** Every value below is stated from
knowledge of these design systems and of published standards (iOS Dynamic Type,
WCAG 2.2, the 60fps frame budget), not scraped from the live sites. The user chose
this path explicitly after being told captures were impossible.

What makes this usable as a bar: every rule is **checkable against rendered pixels**
by a critic who has never seen the builder's reasoning, and a large subset is checked
mechanically by `harness/audit.mjs` and `harness/lh.mjs`. A rule that can only be
satisfied by agreeing with the builder is not in this document.

The judging surface is **393×852 CSS px, DPR 3, mid-tier Android (4× CPU throttle,
simulated Slow 4G)**. Nothing else counts.

---

## 0. Hard floors — fail the round, no discussion

| Floor | Threshold | Checked by |
|---|---|---|
| Lighthouse mobile performance | ≥ 95 | `harness/lh.mjs` |
| Scroll jank | < 1% dropped frames, no frame > 33ms | `harness/audit.mjs` |
| Tap targets | every interactive box ≥ 44×44 CSS px | `harness/audit.mjs` |
| Cumulative layout shift | < 0.1 | `harness/audit.mjs` |
| Horizontal overflow | `scrollWidth` ≤ 393 | `harness/audit.mjs` |

---

## 1. What "Apple's iPhone page" means, operationally

Apple's product pages are not "nice gradients". They are four specific disciplines:

**1.1 One idea per viewport.** At any scroll position, exactly one thing is asking
for attention. A screenshot at any depth should have a single obvious subject. If a
critic can't name the one thing a screenshot is about in three words, the section fails.

**1.2 Type does the work, not chrome.** Headlines are large, tight, and set in a
narrow measure; there are almost no borders, no drop shadows on text containers, no
decorative rules. Hierarchy comes from size and weight jumps, not from boxes.
- Display headline: 40–56px, weight 600–700, `letter-spacing: -0.03em to -0.045em`,
  `line-height: 1.05–1.12`.
- Section headline: 28–34px, weight 600, `letter-spacing: -0.02em`, `line-height: 1.15`.
- Body: 17px (the iOS body size), weight 400, `line-height: 1.47–1.6`,
  measure 32–40 characters at this width. **Never below 15px for body copy.**
- Caption / eyebrow: 12–13px, weight 590, `letter-spacing: 0.06–0.1em`, uppercase,
  used at most once per section.
- The jump between adjacent levels must be ≥ 1.25×. Two levels within 3px of each
  other is a hierarchy failure.

**1.3 Motion is a consequence of scroll, not a timer.** Elements reveal because the
user scrolled to them. Nothing animates on a `setTimeout`. Nothing animates twice.
- Entrance: opacity 0→1 plus translateY 12–24px, duration 500–700ms,
  `cubic-bezier(0.16, 1, 0.3, 1)` (the "out-expo" feel Apple uses for reveals).
- Stagger between siblings: 60–90ms. More than 120ms reads as slow; less than 40ms
  reads as simultaneous.
- Anything pinned/sticky must be driven by scroll position, so scrubbing backwards
  reverses it exactly. A reveal that can't be scrubbed backwards is a timer in disguise.
- **Only `transform` and `opacity` animate.** Animating `top`, `height`, `filter`,
  `box-shadow`, or `background-position` is an automatic fail — it's also what breaks
  the 60fps floor.
- Respect `prefers-reduced-motion: reduce` — reveals become instant, nothing moves.

**1.4 Generous, consistent, un-fussy spacing.** A single spacing scale, visibly
obeyed. Section rhythm at 393px: 72–96px between major sections, 20px page gutters,
never less than 16px. Optical alignment beats mathematical alignment where they differ.

---

## 2. What "Linear's mobile site" means, operationally

**2.1 Near-black, not black; one accent, used sparingly.**
- Page background `#08090A`–`#0D0E10`. Surfaces one step up, `#111214`–`#16181B`.
- Hairlines at `rgba(255,255,255,0.06–0.10)`, 1px, never heavier.
- Primary text `#F7F8F8`. Secondary `#8A8F98`. These two carry ~90% of the page.
- Exactly **one** accent hue. It appears on: the primary CTA, focus rings, and at most
  one other place. An accent used on five things is not an accent.
- Body text contrast ≥ 4.5:1, large text ≥ 3:1, against the actual surface behind it.

**2.2 Surfaces are defined by light, not by lines.** Cards read as raised through a
1px top highlight (`inset 0 1px 0 rgba(255,255,255,0.06)`) and a soft ambient shadow,
not through a visible stroke on all four sides. Radii 12–16px on cards, 10px on
controls, consistent within a tier.

**2.3 Density with air.** Linear is information-dense but never cramped: tight
line-heights on labels (1.2–1.3), loose on prose (1.5–1.6), and real padding inside
cards (16–20px). Text never touches a card edge.

**2.4 Restraint.** No gradients as decoration. Gradients exist only as large, very
low-contrast atmospheric washes behind the hero, or as a 1px border sheen. If a
gradient is nameable as "a gradient" at a glance, it's too strong.

---

## 3. Mobile-specific rules neither desktop reference teaches you

**3.1 The thumb owns the bottom third.** Primary actions live in the lower 40% of the
viewport or in a persistent bottom bar. Anything critical in the top 15% is a design
smell on a 393×852 screen.

**3.2 Safe areas are real.** `viewport-fit=cover` plus `env(safe-area-inset-*)` on
anything fixed to an edge. A fixed bottom bar without `padding-bottom:
env(safe-area-inset-bottom)` fails.

**3.3 Tap targets: 44px is the floor, 48px is the target.** Spacing between adjacent
targets ≥ 8px. A 20px icon needs a 44px padded hit area — measure the *hit area*, not
the glyph.

**3.4 No hover-dependent information.** Anything revealed only on hover does not exist.

**3.5 Momentum scrolling stays native.** No scroll-hijacking, no `scroll-behavior`
overrides on the document, no JS-driven scroll position. Sticky/pinned sections must
still let a fling pass through at native speed.

**3.6 Text selection and zoom.** Never `user-select: none` on prose. Never
`maximum-scale=1` or `user-scalable=no`.

---

## 4. Performance, as a design constraint

The ≥95 floor on a 4×-throttled CPU forces these, so treat them as design rules:

- **Zero third-party requests.** Fonts, icons, and images ship from the same origin
  or are inlined. No CDN, no Google Fonts link, no analytics.
- **System font stack** unless a webfont earns its bytes; if one is used it is
  subsetted, `woff2`, `font-display: swap`, and preloaded. `-apple-system,
  BlinkMacSystemFont, 'SF Pro Text', system-ui` renders as SF on iOS and Roboto on
  Android — both are correct for their platform and cost 0 bytes.
- **LCP element is text or an inlined SVG**, above the fold, with no webfont
  dependency and no animation delaying its paint. LCP under 2.0s on Slow 4G.
- **Total blocking time under 150ms.** That means: no framework, no hydration, and
  scroll work confined to `IntersectionObserver` and CSS. A `scroll` listener that
  does layout reads is the single most likely cause of a jank failure.
- **Every image has explicit `width`/`height`** (or `aspect-ratio`) so CLS stays 0.
- Critical CSS inline in `<head>`; nothing render-blocking below it.

---

## 5. How a critic decides

Load the running page at 393×852 on the throttled profile. Look at the rendered
pixels and the motion — never a description of them. Then, for the assigned piece only:

1. **Name the one thing this piece is about in three words.** If you can't, it fails.
2. Walk §1–§4 and record every rule it violates, with the measured value.
3. State the **single biggest remaining gap** — one sentence, naming a specific
   element and a specific change. Not a list.
4. Verdict: does this piece clear the bar described above, yes or no?

A critic that reports "looks polished" has not done the job. Every claim must cite a
measured number or a specific pixel region.
