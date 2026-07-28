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
    { b64: buf.toString('base64'), w: 400, q: 0.72 }
  );

const capRoot = join(ROOT, 'captures');
const labels = (await exists(capRoot))
  ? (await readdir(capRoot, { withFileTypes: true })).filter((d) => d.isDirectory() && d.name !== 'parts').map((d) => d.name).sort()
  : [];

const rounds = [];
for (const label of labels) {
  const dir = join(capRoot, label);
  const files = (await readdir(dir)).sort();
  const shots = [];
  for (const f of files.filter((x) => x.endsWith('.png'))) {
    shots.push(await shrink(await readFile(join(dir, f))));
  }
  const vidFile = files.find((f) => f.endsWith('.webm'));
  let vid = null;
  if (vidFile) {
    const b = await readFile(join(dir, vidFile));
    // Skip anything that would blow up the page; a scroll recording is normally ~80 KB.
    if (b.length < 2_500_000) vid = 'data:video/webm;base64,' + b.toString('base64');
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

await writeFile(OUT, html);
console.log(`${OUT} — ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, ${rounds.length} rounds, ${verdicts.length} verdicts`);
