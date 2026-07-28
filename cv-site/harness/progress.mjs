// Regenerate the phone-readable progress page from whatever is on disk.
//   node harness/progress.mjs
import { readdir, readFile, writeFile, stat, mkdir, copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = join(ROOT, 'progress');

const readJson = async (p) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } };
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

const badge = (ok, label, detail) =>
  `<span class="b ${ok === null ? 'u' : ok ? 'p' : 'f'}">${label}${detail ? ` <em>${detail}</em>` : ''}</span>`;

const run = async () => {
  await mkdir(join(OUT, 'shots'), { recursive: true });

  // --- gather rounds ------------------------------------------------------
  const capRoot = join(ROOT, 'captures');
  const labels = (await exists(capRoot)) ? (await readdir(capRoot, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  labels.sort();

  const rounds = [];
  for (const label of labels) {
    const dir = join(capRoot, label);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    const video = (await readdir(dir)).find((f) => f.endsWith('.webm'));
    const shots = [];
    for (const f of files) {
      await copyFile(join(dir, f), join(OUT, 'shots', `${label}-${basename(f)}`));
      shots.push(`shots/${label}-${basename(f)}`);
    }
    let vid = null;
    if (video) { await copyFile(join(dir, video), join(OUT, 'shots', `${label}-${video}`)); vid = `shots/${label}-${video}`; }
    const audit = await readJson(join(ROOT, 'reports', `audit-${label}.json`));
    const lh = await readJson(join(ROOT, 'reports', `lh-${label}.json`));
    const mtime = (await stat(dir)).mtime.toISOString().replace('T', ' ').slice(0, 16);
    rounds.push({ label, shots, vid, audit, lh, mtime });
  }
  rounds.reverse();

  const verdicts = (await exists(join(ROOT, 'reports')))
    ? (await readdir(join(ROOT, 'reports'))).filter((f) => f.startsWith('verdict-') && f.endsWith('.json'))
    : [];
  const critiques = [];
  for (const f of verdicts) {
    const v = await readJson(join(ROOT, 'reports', f));
    if (v) critiques.push({ file: f, ...v });
  }

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>CV site — build progress</title>
<style>
  :root{color-scheme:dark;--bg:#08090a;--card:#111214;--line:#1f2124;--tx:#f7f8f8;--dim:#8a8f98;--p:#3fb950;--f:#f85149;--u:#484f58}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 -apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;padding:env(safe-area-inset-top) 0 4rem}
  header{padding:1.25rem 1rem .75rem;position:sticky;top:0;background:rgba(8,9,10,.86);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);z-index:9}
  h1{margin:0;font-size:1.0625rem;letter-spacing:-.01em}
  .sub{color:var(--dim);font-size:.8125rem;margin-top:.2rem}
  section{padding:1rem}
  h2{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:1.5rem 0 .6rem;font-weight:590}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.9rem;margin-bottom:.75rem}
  .b{display:inline-flex;align-items:center;gap:.35rem;font-size:.75rem;padding:.3rem .55rem;border-radius:7px;margin:.15rem .3rem .15rem 0;font-weight:590}
  .b.p{background:rgba(63,185,80,.14);color:var(--p)} .b.f{background:rgba(248,81,73,.14);color:var(--f)} .b.u{background:rgba(72,79,88,.2);color:var(--dim)}
  .b em{font-style:normal;opacity:.75;font-weight:400}
  .strip{display:flex;gap:.5rem;overflow-x:auto;padding:.25rem 0 .6rem;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
  .strip img,.strip video{height:340px;border-radius:10px;border:1px solid var(--line);scroll-snap-align:start;flex:0 0 auto;background:#000}
  .meta{color:var(--dim);font-size:.75rem}
  ul{margin:.4rem 0 0;padding-left:1.1rem;color:var(--dim);font-size:.8125rem}
  li{margin:.2rem 0}
  code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#a5d6ff}
  .empty{color:var(--dim);font-size:.875rem;padding:1rem;border:1px dashed var(--line);border-radius:12px;text-align:center}
</style></head><body>
<header>
  <h1>CV site — build progress</h1>
  <div class="sub">393×852 · mid-tier Android · updated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC</div>
</header>
<section>
  <h2>Hard floors</h2>
  ${rounds[0] ? `<div class="card">
    ${badge(rounds[0].lh ? rounds[0].lh.performance >= 95 : null, 'Lighthouse perf ≥95', rounds[0].lh ? String(rounds[0].lh.performance) : '—')}
    ${badge(rounds[0].audit ? rounds[0].audit.scroll.pass : null, '60fps scroll', rounds[0].audit ? `${rounds[0].audit.scroll.jankPct}% dropped` : '—')}
    ${badge(rounds[0].audit ? rounds[0].audit.tapTargets.pass : null, 'Tap targets ≥44px', rounds[0].audit ? `${rounds[0].audit.tapTargets.failures.length} under` : '—')}
    ${badge(rounds[0].audit ? rounds[0].audit.cls.pass : null, 'CLS', rounds[0].audit ? String(rounds[0].audit.cls.value) : '—')}
    ${badge(rounds[0].audit ? rounds[0].audit.overflow.pass : null, 'No h-overflow', '')}
    ${rounds[0].audit && rounds[0].audit.tapTargets.failures.length ? `<ul>${rounds[0].audit.tapTargets.failures.slice(0, 8).map((t) => `<li><code>${t.tag}${t.cls ? '.' + t.cls.split(' ')[0] : ''}</code> ${t.w}×${t.h} — "${t.text}"</li>`).join('')}</ul>` : ''}
  </div>` : '<div class="empty">No run yet.</div>'}

  <h2>Critic verdicts</h2>
  ${critiques.length ? critiques.map((c) => `<div class="card">
      <strong>${c.piece || c.file}</strong> ${badge(c.wins === true, c.wins === true ? 'wins' : 'loses', c.round ? `round ${c.round}` : '')}
      ${c.biggestGap ? `<div class="meta" style="margin-top:.45rem">Biggest gap: ${c.biggestGap}</div>` : ''}
    </div>`).join('') : '<div class="empty">No verdicts recorded yet.</div>'}

  <h2>Captures</h2>
  ${rounds.length ? rounds.map((r) => `<div class="card">
      <strong>${r.label}</strong> <span class="meta">· ${r.shots.length} depths · ${r.mtime}</span>
      <div class="strip">
        ${r.vid ? `<video src="${r.vid}" controls muted playsinline preload="metadata"></video>` : ''}
        ${r.shots.map((s) => `<img src="${s}" loading="lazy" alt="">`).join('')}
      </div>
      ${r.lh ? `<div class="meta">LCP ${Math.round(r.lh.metrics.LCP)}ms · TBT ${Math.round(r.lh.metrics.TBT)}ms · SI ${Math.round(r.lh.metrics.SI)}ms · a11y ${r.lh.accessibility}</div>` : ''}
    </div>`).join('') : '<div class="empty">No captures yet.</div>'}
</section>
</body></html>`;

  await writeFile(join(OUT, 'index.html'), html);
  console.log(`progress page → ${join(OUT, 'index.html')} (${rounds.length} rounds, ${critiques.length} verdicts)`);
};

run().catch((e) => { console.error(e); process.exit(1); });
