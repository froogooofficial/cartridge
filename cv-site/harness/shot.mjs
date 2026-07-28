// Screenshot one section of the RUNNING composed page, plus a motion filmstrip of its
// reveal, so a critic can look at exactly its assigned piece.
//
//   node harness/shot.mjs <sectionId> <outDir> [url]
//
// Emits: <outDir>/<id>-viewport-NNN.png   (what the user actually sees, per depth)
//        <outDir>/<id>-element.png        (the section on its own)
//        <outDir>/<id>-motion-NNN.png     (filmstrip through the reveal)
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contextOptions, CPU_THROTTLE, VIEWPORT } from './profile.mjs';

const [id, outDir, url = 'http://127.0.0.1:4173/'] = process.argv.slice(2);
if (!id || !outDir) { console.error('usage: shot.mjs <sectionId> <outDir> [url]'); process.exit(1); }
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
const context = await browser.newContext(contextOptions());
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(1200);

const el = page.locator(`#${id}`).first();
const count = await el.count();
if (!count) {
  console.log(JSON.stringify({ error: `no element with id "${id}"`, ids: await page.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id)) }, null, 2));
  await browser.close();
  process.exit(1);
}

const box = await el.boundingBox();
const out = { id, url, box, viewportShots: [], motionShots: [], element: null };

// --- Motion filmstrip: scroll the section in from below and sample the reveal ----
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const target = Math.max(0, (await el.boundingBox()).y - VIEWPORT.height * 0.72);
await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target);
for (let i = 0; i < 6; i++) {
  const f = join(outDir, `${id}-motion-${String(i).padStart(3, '0')}.png`);
  await page.screenshot({ path: f });
  out.motionShots.push(f);
  await page.waitForTimeout(130);
}

// --- The section as the user sees it, one viewport at a time --------------------
const b = await el.boundingBox();
const screens = Math.max(1, Math.ceil(b.height / VIEWPORT.height));
for (let i = 0; i < screens; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), b.y + i * VIEWPORT.height);
  await page.waitForTimeout(700);
  const f = join(outDir, `${id}-viewport-${String(i).padStart(3, '0')}.png`);
  await page.screenshot({ path: f });
  out.viewportShots.push(f);
}

// --- The section alone ----------------------------------------------------------
const elFile = join(outDir, `${id}-element.png`);
await el.screenshot({ path: elFile }).catch(() => {});
out.element = elFile;

// --- Measurements the critic must cite ------------------------------------------
out.measured = await page.evaluate((sid) => {
  const root = document.getElementById(sid);
  const rows = [];
  const walk = (n) => {
    for (const c of n.children) {
      const s = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      if (r.width && c.textContent && c.textContent.trim() && c.children.length === 0) {
        rows.push({
          tag: c.tagName.toLowerCase(),
          cls: typeof c.className === 'string' ? c.className : '',
          text: c.textContent.trim().slice(0, 40),
          fontPx: Math.round(parseFloat(s.fontSize) * 10) / 10,
          weight: s.fontWeight,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing,
          color: s.color,
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
      walk(c);
    }
  };
  if (root) walk(root);
  const taps = [];
  for (const c of (root || document).querySelectorAll('a,button,[role="button"],input,select,textarea,summary')) {
    const r = c.getBoundingClientRect();
    taps.push({ tag: c.tagName.toLowerCase(), text: (c.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), ok: r.width >= 43.5 && r.height >= 43.5 });
  }
  return { textNodes: rows.slice(0, 40), taps, sectionHeight: root ? Math.round(root.getBoundingClientRect().height) : 0 };
}, id);

await context.close();
await browser.close();
await writeFile(join(outDir, `${id}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
