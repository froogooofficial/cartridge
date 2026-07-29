import { chromium } from 'playwright';
import { contextOptions, CPU_THROTTLE } from './profile.mjs';

const browser = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
const context = await browser.newContext(contextOptions());
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1000);
await page.evaluate(() => document.getElementById('work').scrollIntoView());
await page.waitForTimeout(1000);

const info = await page.evaluate(() => {
  const out = {};
  // pseudo elements on tabs
  out.tabPseudo = [...document.querySelectorAll('.dock-tab')].map(a => {
    const b = getComputedStyle(a, '::before'), af = getComputedStyle(a, '::after');
    return {
      href: a.getAttribute('href'), aria: a.getAttribute('aria-current'),
      before: { content: b.content, bg: b.backgroundColor, inset: [b.top,b.right,b.bottom,b.left].join(' '), w: b.width, h: b.height, radius: b.borderRadius, transform: b.transform, opacity: b.opacity, transition: b.transitionProperty + ' ' + b.transitionDuration, boxShadow: b.boxShadow },
      after: { content: af.content, bg: af.backgroundColor, w: af.width, h: af.height, transform: af.transform, opacity: af.opacity, transition: af.transitionProperty + ' ' + af.transitionDuration },
    };
  });
  // stylesheet text search
  let css = '';
  for (const s of document.styleSheets) { try { for (const r of s.cssRules) css += r.cssText + '\n'; } catch {} }
  out.cssLen = css.length;
  const grab = (re) => (css.match(re) || []).slice(0, 12);
  out.envUses = grab(/[^;{}]*env\(safe-area[^;{}]*/g);
  out.accentDecls = grab(/[^;{}]*(124,\s*140,\s*255|--accent[^;{}]*)/g);
  out.dockRules = grab(/\.dock[^{]*\{[^}]*\}/g);
  out.reducedMotion = /prefers-reduced-motion/.test(css);
  out.reducedMotionRules = grab(/@media[^{]*prefers-reduced-motion[^{]*\{[\s\S]{0,400}/g);
  // enumerate elements painted with the accent
  const accent = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    for (const p of ['color','backgroundColor','borderTopColor','fill','stroke','outlineColor']) {
      if (/124,\s*140,\s*255/.test(cs[p])) accent.push({ tag: el.tagName, cls: String(el.className).slice(0,40), prop: p, val: cs[p] });
    }
  }
  out.accentPainted = accent;
  return out;
});
console.log(JSON.stringify(info, null, 1));

// pixel probe of the dock band, correctly located
const shot = await page.screenshot();
const b64 = shot.toString('base64');
const px = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const at = (cx, cy) => { const d = g.getImageData(Math.round(cx*3), Math.round(cy*3), 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; };
  const lum = (cx, cy) => { const d = g.getImageData(Math.round(cx*3), Math.round(cy*3), 1, 1).data; return Math.round(0.2126*d[0]+0.7152*d[1]+0.0722*d[2]); };
  // max luminance across the 12px band below the pill (CSS y 841..851), full width
  let maxBand = 0, maxAt = null;
  const band = g.getImageData(0, 841*3, img.width, 11*3).data;
  for (let i = 0; i < band.length; i += 4) {
    const L = 0.2126*band[i]+0.7152*band[i+1]+0.0722*band[i+2];
    if (L > maxBand) { maxBand = L; maxAt = i/4; }
  }
  // horizontal scan across the pill interior at CSS y=800 to find the active chip edges
  const row = g.getImageData(0, 800*3, img.width, 1).data;
  const scan = [];
  for (let x = 60; x < 1120; x += 3) { const i = x*4; scan.push([Math.round(x/3), Math.round(0.2126*row[i]+0.7152*row[i+1]+0.0722*row[i+2])]); }
  return {
    workTabInterior: at(34, 792), workTabInterior2: at(57, 800),
    careerTabInterior: at(104, 792), careerTabInterior2: at(127, 800),
    pillGapBetweenTabs: at(94, 800),
    pillFarLeftInsidePill: at(24, 800),
    outsidePillLeft: at(8, 800),
    ctaCentre: at(341, 808),
    bandMaxLuminance: Math.round(maxBand),
    bandMaxIndex: maxAt,
    pageBgAtBand: at(196, 848),
    rowScanY800: scan,
  };
}, b64);
console.log('==== pixels ====');
console.log(JSON.stringify({ ...px, rowScanY800: undefined }, null, 1));
console.log('row scan y=800 (cssX,lum):', JSON.stringify(px.rowScanY800));

await browser.close();
