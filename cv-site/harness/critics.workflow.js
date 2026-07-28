export const meta = {
  name: 'cv-mobile-critics',
  description: 'Blind critics judge each piece of the running mobile CV site against the codified bar',
  phases: [{ title: 'Judge', detail: 'one clean-context critic per piece, looking at rendered pixels' }],
}

const ROOT = '/home/user/cartridge/cv-site'
const ROUND = (args && args.round) || 1
const URL = (args && args.url) || 'http://127.0.0.1:4173/'
const PIECES = (args && args.pieces) || [
  { id: 'nav', what: 'the persistent navigation' },
  { id: 'hero', what: 'the first viewport' },
  { id: 'proof', what: 'the credibility strip and its scroll reveal' },
  { id: 'work', what: 'the selected-work cards' },
  { id: 'experience', what: 'the career timeline' },
  { id: 'skills', what: 'the capabilities section' },
  { id: 'contact', what: 'the closing section and its tap targets' },
]

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['piece', 'threeWords', 'wins', 'biggestGap', 'violations', 'evidence'],
  properties: {
    piece: { type: 'string' },
    threeWords: {
      type: 'string',
      description: 'The one thing this piece is about, in at most three words. If you genuinely cannot name it, write "CANNOT NAME" — that is itself a failure.',
    },
    wins: { type: 'boolean', description: 'Does this piece clear the bar in SPEC.md? Be strict. Most first drafts do not.' },
    score: { type: 'integer', minimum: 1, maximum: 10, description: '1-10 against the bar. 7 = competent but not at the bar. 9+ = genuinely at the bar.' },
    biggestGap: {
      type: 'string',
      description: 'ONE sentence naming a specific element and a specific change. Not a list. This is what gets sent back to a builder.',
    },
    violations: {
      type: 'array',
      description: 'Every SPEC rule broken, each with the measured value that proves it.',
      items: {
        type: 'object',
        required: ['rule', 'measured', 'where'],
        properties: {
          rule: { type: 'string', description: 'SPEC section and rule, e.g. "1.2 type jump >=1.25x"' },
          measured: { type: 'string', description: 'The actual measured value, e.g. "h3 19px vs body 17px = 1.12x"' },
          where: { type: 'string', description: 'Element/selector or pixel region' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
        },
      },
    },
    evidence: { type: 'string', description: 'Which screenshot files you actually opened and looked at.' },
    motion: { type: 'string', description: 'What the reveal actually looked like across the motion filmstrip, or "none observed".' },
  },
}

const CRITIC_BRIEF = (p) => `
You are a design critic. You have NOT seen how this was built and you must not ask.
You judge ONE piece of a mobile CV website: the section with id="${p.id}" — ${p.what}.

THE BAR: read ${ROOT}/reference/SPEC.md completely. That document is the standard.
Pay particular attention to section 5, which tells you how to decide.

THE SUBJECT: the site is running at ${URL}, rendered at 393x852 CSS px, DPR 3, on a
mid-tier Android profile (4x CPU throttle). That is the only surface that counts.

CAPTURE IT YOURSELF — do not trust anyone's description:
    cd ${ROOT} && node harness/shot.mjs ${p.id} ${ROOT}/captures/critic-r${ROUND}/${p.id} ${URL}
This writes, into that directory:
  ${p.id}-viewport-NNN.png  what the user actually sees, one viewport at a time
  ${p.id}-element.png       the section on its own
  ${p.id}-motion-NNN.png    a 6-frame filmstrip sampled through the section's scroll reveal
and prints measured font sizes, weights, line-heights, letter-spacing, colours and tap-target
boxes for every text node in the section.

YOU MUST OPEN THE IMAGES WITH THE Read TOOL AND LOOK AT THEM. A verdict written from the
printed JSON alone is worthless and will be discarded. Look at the pixels. Then flip through
the motion frames in order and describe what actually moved — if all six frames are identical,
either nothing animates or the reveal already completed, and you should say which.

HOW TO JUDGE:
  1. Name in three words the one thing this piece is about (SPEC 1.1). If you cannot, it fails.
  2. Walk SPEC sections 1-4 and record every rule broken, each with the MEASURED value that
     proves it. "The heading feels small" is not a finding. "h2 is 24px against 17px body =
     1.41x, passes" is. Use the numbers the harness printed.
  3. Check the type scale jumps, the accent count, the tap-target boxes, the measure in
     characters, and whether anything animates that is not transform or opacity.
  4. State the SINGLE biggest remaining gap in one sentence, naming a specific element and a
     specific change. This sentence is handed straight to a builder, so it must be actionable.

BE STRICT. The bar is Apple's iPhone product page and Linear's mobile site. A competent,
tidy section that would pass code review is roughly a 7 and does NOT clear this bar.
Reserve wins:true for work that genuinely holds up against that comparison. If you find
yourself writing "looks polished", you have not done the job.

Finally, write your verdict to ${ROOT}/reports/verdict-${p.id}.json as JSON with exactly the
keys of your structured output, plus "round": ${ROUND}. Then return the structured output.
`

phase('Judge')
const verdicts = await parallel(
  PIECES.map((p) => () =>
    agent(CRITIC_BRIEF(p), {
      label: `critic:${p.id}`,
      phase: 'Judge',
      schema: VERDICT_SCHEMA,
      effort: 'high',
    })
  )
)

const got = verdicts.filter(Boolean)
const losers = got.filter((v) => !v.wins)
log(`round ${ROUND}: ${got.length - losers.length}/${got.length} pieces clear the bar`)
for (const v of losers) log(`  ${v.piece} (${v.score ?? '?'}/10): ${v.biggestGap}`)

return {
  round: ROUND,
  verdicts: got,
  losers: losers.map((v) => ({ piece: v.piece, score: v.score, biggestGap: v.biggestGap, blockers: (v.violations || []).filter((x) => x.severity === 'blocker') })),
  allWin: losers.length === 0,
}
