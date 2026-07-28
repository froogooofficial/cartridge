// Build + screenshot ONE part in isolation, on its own port, so parallel builders
// never collide over site/index.html or a shared port.
//
//   node harness/preview.mjs <partName> [port]
//
// Emits: captures/parts/<part>-000.png ... and prints the audit for that part only.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { contextOptions, CPU_THROTTLE, VIEWPORT } from './profile.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const [part, portArg] = process.argv.slice(2);
if (!part) { console.error('usage: preview.mjs <partName> [port]'); process.exit(1); }
const PORT = Number(portArg || 4200 + (part.charCodeAt(0) % 90));

const read = async (p, f = '') => { try { return await readFile(p, 'utf8'); } catch { return f; } };

// Reuse build.mjs's template engine by shelling out to a one-part order.
const orderPath = join(ROOT, 'site', 'parts', 'order.json');
const realOrder = await read(orderPath, '[]');
const outFile = join(ROOT, 'site', `.preview-${part}.html`);

await writeFile(orderPath, JSON.stringify([part]));
let built;
try {
  execFileSync('node', [join(ROOT, 'harness', 'build.mjs')], { stdio: 'pipe' });
  built = await read(join(ROOT, 'site', 'index.html'));
} finally {
  await writeFile(orderPath, realOrder); // always restore the real order
}
await writeFile(outFile, built);

const server = createServer(async (req, res) => {
  const name = req.url === '/' ? `.preview-${part}.html` : req.url.slice(1);
  try {
    const body = await readFile(join(ROOT, 'site', decodeURIComponent(name)));
    res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('404'); }
}).listen(PORT);

const outDir = join(ROOT, 'captures', 'parts');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
const context = await browser.newContext(contextOptions());
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);

const h = await page.evaluate(() => document.documentElement.scrollHeight);
const screens = Math.max(1, Math.ceil(h / VIEWPORT.height));
const shots = [];
for (let i = 0; i < screens; i++) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), i * VIEWPORT.height);
  await page.waitForTimeout(800);
  const f = join(outDir, `${part}-${String(i).padStart(3, '0')}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
}

const tap = await page.evaluate(() => {
  const sel = 'a, button, [role="button"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    let w = r.width, h = r.height;
    for (const ps of ['::before', '::after']) {
      const p = getComputedStyle(el, ps);
      if (p.content === 'none' || p.position !== 'absolute') continue;
      const px = (v) => (v === 'auto' ? 0 : parseFloat(v) || 0);
      w = Math.max(w, r.width + Math.abs(px(p.left)) + Math.abs(px(p.right)));
      h = Math.max(h, r.height + Math.abs(px(p.top)) + Math.abs(px(p.bottom)));
    }
    if (w + 0.5 < 44 || h + 0.5 < 44)
      out.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 40), w: Math.round(w), h: Math.round(h) });
  }
  return out;
});
const overflow = await page.evaluate(() => document.documentElement.scrollWidth);

await context.close();
await browser.close();
server.close();
await rm(outFile, { force: true });

console.log(JSON.stringify({ part, port: PORT, screens, shots, tapFailures: tap, scrollWidth: overflow, overflowPass: overflow <= 394 }, null, 2));
