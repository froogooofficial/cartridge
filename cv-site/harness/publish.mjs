// Produce a fully self-contained progress page (every capture inlined as a data URI)
// so it can be published and opened on a phone. A strict CSP blocks external hosts,
// so nothing may reference a file.
//   node harness/publish.mjs [outFile]
import { chromium } from 'playwright';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = process.argv[2] || join(ROOT, 'progress', 'standalone.html');

const readJson = async (p) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } };
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

// Re-encode screenshots to narrow WebP in-browser; a 393x852 DPR3 PNG is ~75 KB
// and there are dozens of them, which would make the page unusable on cellular.
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('data:text/html,<html><body></body></html>');
const shrink = (buf) =>
  page.evaluate(
    async ({ b64, w, q }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
      const scale = Math.min(1, w / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', q);
    },
    { b64: buf.toString('base64'), w: SHOT_W, q: SHOT_Q }
  );

// Hard payload budget. Every capture is a data URI, so it is all parsed before
// the page paints — lazy-loading cannot help. A 2.3MB page showed a phone nothing
// but a spinner, so the budget is enforced here rather than hoped for.
const MAX_BYTES = 900_000;
const SHOT_W = 360;
const SHOT_Q = 0.62;
const MAX_SHOTS = 8;
const INLINE_VIDEO = false;

const capRoot = join(ROOT, 'captures');
// Newest by mtime, not by name — a lexicographic sort put the old "smoke" stub
// after "r5" and published the wrong round.
let labels = [];
if (await exists(capRoot)) {
  const dirs = (await readdir(capRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name !== 'parts')
    .map((d) => d.name);
  const stamped = [];
  for (const name of dirs) {
    // Only run directories qualify: critic output is nested per piece and has no
    // PNGs of its own, so it would publish an empty round.
    const inner = await readdir(join(capRoot, name));
    if (!inner.some((f) => f.endsWith('.png'))) continue;
    stamped.push({ name, t: (await stat(join(capRoot, name))).mtimeMs });
  }
  stamped.sort((a, b) => b.t - a.t);
  labels = stamped.slice(0, 1).map((x) => x.name);
}

const rounds = [];
for (const label of labels) {
  const dir = join(capRoot, label);
  const files = (await readdir(dir)).sort();
  const shots = [];
  const pngs = files.filter((x) => x.endsWith('.png'));
  // Sample evenly across scroll depth rather than truncating to the first N,
  // so the strip still represents the whole page.
  const step = Math.max(1, Math.ceil(pngs.length / MAX_SHOTS));
  const picked = pngs.filter((_, i) => i % step === 0).slice(0, MAX_SHOTS);
  for (const f of picked) shots.push(await shrink(await readFile(join(dir, f))));
  if (picked.length < pngs.length) console.log(`  note: showing ${picked.length} of ${pngs.length} depths for ${label}`);
  // The scroll recording stays on disk; base64 video is the single biggest blob
  // and the filmstrip already shows what the scroll looks like.
  const vidFile = files.find((f) => f.endsWith('.webm'));
  let vid = null;
  if (INLINE_VIDEO && vidFile) {
    const b = await readFile(join(dir, vidFile));
    if (b.length < 400_000) vid = 'data:video/webm;base64,' + b.toString('base64');
  }
  rounds.push({
    label,
    shots,
    vid,
    audit: await readJson(join(ROOT, 'reports', `audit-${label}.json`)),
    lh: await readJson(join(ROOT, 'reports', `lh-${label}.json`)),
    mtime: (await stat(dir)).mtime.toISOString().replace('T', ' ').slice(0, 16),
  });
}
await browser.close();
rounds.reverse();

const verdicts = [];
if (await exists(join(ROOT, 'reports'))) {
  for (const f of (await readdir(join(ROOT, 'reports'))).filter((x) => x.startsWith('verdict-'))) {
    const v = await readJson(join(ROOT, 'reports', f));
    if (v) verdicts.push(v);
  }
}
verdicts.sort((a, b) => (b.round || 0) - (a.round || 0) || String(a.piece).localeCompare(String(b.piece)));

const badge = (ok, label, detail) =>
  `<span class="b ${ok === null || ok === undefined ? 'u' : ok ? 'p' : 'f'}">${label}${detail ? ` <em>${detail}</em>` : ''}</span>`;
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const latest = rounds[0];
const html = `<title>CV site — build progress</title>
<style>
  :root{--bg:#08090a;--card:#111214;--line:#1f2124;--tx:#f7f8f8;--dim:#8a8f98;--p:#3fb950;--f:#f85149}
  @media (prefers-color-scheme: light){:root{--bg:#fbfbfc;--card:#fff;--line:#e6e8eb;--tx:#0d0e10;--dim:#6b7280;--p:#1a7f37;--f:#cf222e}}
  :root[data-theme=dark]{--bg:#08090a;--card:#111214;--line:#1f2124;--tx:#f7f8f8;--dim:#8a8f98;--p:#3fb950;--f:#f85149}
  :root[data-theme=light]{--bg:#fbfbfc;--card:#fff;--line:#e6e8eb;--tx:#0d0e10;--dim:#6b7280;--p:#1a7f37;--f:#cf222e}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 -apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;padding-bottom:3rem;overflow-x:hidden}
  header{padding:1.25rem 1rem .8rem;border-bottom:1px solid var(--line)}
  h1{margin:0;font-size:1.0625rem;letter-spacing:-.015em}
  .sub{color:var(--dim);font-size:.8125rem;margin-top:.25rem}
  section{padding:0 1rem}
  h2{font-size:.6875rem;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);margin:1.6rem 0 .6rem;font-weight:600}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.9rem;margin-bottom:.7rem}
  .b{display:inline-flex;gap:.35rem;font-size:.75rem;padding:.32rem .58rem;border-radius:7px;margin:.15rem .3rem .15rem 0;font-weight:600}
  .b.p{background:color-mix(in srgb,var(--p) 16%,transparent);color:var(--p)}
  .b.f{background:color-mix(in srgb,var(--f) 16%,transparent);color:var(--f)}
  .b.u{background:color-mix(in srgb,var(--dim) 16%,transparent);color:var(--dim)}
  .b em{font-style:normal;opacity:.8;font-weight:400}
  .strip{display:flex;gap:.5rem;overflow-x:auto;padding:.3rem 0 .7rem;scroll-snap-type:x mandatory}
  .strip img,.strip video{height:330px;border-radius:10px;border:1px solid var(--line);scroll-snap-align:start;flex:0 0 auto;background:#000}
  .meta{color:var(--dim);font-size:.75rem;margin-top:.3rem}
  ul{margin:.45rem 0 0;padding-left:1.1rem;color:var(--dim);font-size:.8125rem}
  code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
  .empty{color:var(--dim);font-size:.875rem;padding:1rem;border:1px dashed var(--line);border-radius:12px;text-align:center}
</style>
<header>
  <h1>CV site — build progress</h1>
  <div class="sub">393×852 · mid-tier Android · ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC</div>
</header>
<section>
  <h2>Hard floors</h2>
  ${latest ? `<div class="card">
    ${badge(latest.lh ? latest.lh.performance >= 95 : null, 'Lighthouse ≥95', latest.lh ? String(latest.lh.performance) : '—')}
    ${badge(latest.audit ? latest.audit.scroll.pass : null, '60fps scroll', latest.audit ? `${latest.audit.scroll.jankPct}% dropped` : '—')}
    ${badge(latest.audit ? latest.audit.tapTargets.pass : null, 'Tap ≥44px', latest.audit ? `${latest.audit.tapTargets.failures.length} under` : '—')}
    ${badge(latest.audit ? latest.audit.cls.pass : null, 'CLS', latest.audit ? String(latest.audit.cls.value) : '—')}
    ${badge(latest.audit ? latest.audit.overflow.pass : null, 'No overflow', '')}
    ${latest.audit && latest.audit.tapTargets.failures.length ? `<ul>${latest.audit.tapTargets.failures.slice(0, 8).map((t) => `<li><code>${esc(t.tag)}</code> ${t.w}×${t.h} — "${esc(t.text)}"</li>`).join('')}</ul>` : ''}
  </div>` : '<div class="empty">No run yet.</div>'}

  <h2>Critic verdicts</h2>
  ${verdicts.length ? verdicts.map((c) => `<div class="card">
      <strong>${esc(c.piece)}</strong> ${badge(c.wins === true, c.wins === true ? 'clears the bar' : 'below the bar', c.round ? `round ${c.round}` : '')}
      ${c.biggestGap ? `<div class="meta">Biggest gap: ${esc(c.biggestGap)}</div>` : ''}
    </div>`).join('') : '<div class="empty">No verdicts yet.</div>'}

  <h2>Captures</h2>
  ${rounds.length ? rounds.map((r) => `<div class="card">
      <strong>${esc(r.label)}</strong> <span class="meta">${r.shots.length} depths · ${r.mtime}</span>
      <div class="strip">
        ${r.vid ? `<video src="${r.vid}" controls muted playsinline preload="metadata"></video>` : ''}
        ${r.shots.map((s) => `<img src="${s}" loading="lazy" alt="capture">`).join('')}
      </div>
      ${r.lh ? `<div class="meta">LCP ${Math.round(r.lh.metrics.LCP)}ms · TBT ${Math.round(r.lh.metrics.TBT)}ms · a11y ${r.lh.accessibility}</div>` : ''}
    </div>`).join('') : '<div class="empty">No captures yet.</div>'}
</section>`;

const bytes = Buffer.byteLength(html);
await writeFile(OUT, html);
console.log(`${OUT} — ${(bytes / 1024).toFixed(0)} KB, ${rounds.length} round(s), ${verdicts.length} verdicts`);
if (bytes > MAX_BYTES) {
  console.error(`FAIL: ${(bytes / 1024).toFixed(0)} KB exceeds the ${(MAX_BYTES / 1024).toFixed(0)} KB budget — it will show a phone a spinner.`);
  process.exit(1);
}
