import { chromium } from 'playwright';
import { contextOptions, CPU_THROTTLE, VIEWPORT } from './profile.mjs';

const browser = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
const context = await browser.newContext(contextOptions());
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);

const dump = async (label) => {
  const r = await page.evaluate(() => {
    const pick = (el, props) => Object.fromEntries(props.map(p => [p, getComputedStyle(el)[p]]));
    const P = ['position','bottom','left','right','width','height','padding','paddingBottom','margin','background','backgroundColor','backdropFilter','webkitBackdropFilter','border','borderRadius','boxShadow','opacity','transform','transition','zIndex','color','mixBlendMode','isolation','willChange','filter','gap','display','alignItems','justifyContent'];
    const out = {};
    const shell = document.querySelector('.dock-shell');
    const dock = document.querySelector('.dock');
    out.shell = { rect: shell.getBoundingClientRect().toJSON(), style: pick(shell, P) };
    out.dock = { rect: dock.getBoundingClientRect().toJSON(), style: pick(dock, P) };
    out.tabs = [...document.querySelectorAll('.dock-tab')].map(a => ({
      href: a.getAttribute('href'),
      active: a.className,
      ariaCurrent: a.getAttribute('aria-current'),
      rect: a.getBoundingClientRect().toJSON(),
      style: pick(a, P),
      label: (() => { const s = a.querySelector('.dock-lb'); return { rect: s.getBoundingClientRect().toJSON(), style: pick(s, P), font: getComputedStyle(s).font, fs: getComputedStyle(s).fontSize, fw: getComputedStyle(s).fontWeight, ls: getComputedStyle(s).letterSpacing, lh: getComputedStyle(s).lineHeight, color: getComputedStyle(s).color } })(),
      ico: (() => { const s = a.querySelector('.dock-ico'); return { rect: s.getBoundingClientRect().toJSON(), color: getComputedStyle(s).color, opacity: getComputedStyle(s).opacity, w: getComputedStyle(s).width, h: getComputedStyle(s).height } })(),
    }));
    const cta = document.querySelector('.dock-cta');
    out.cta = { rect: cta.getBoundingClientRect().toJSON(), style: pick(cta, P) };
    // pseudo elements
    out.pseudo = {};
    for (const [k, sel] of [['shellBefore','.dock-shell'],['dockBefore','.dock'],['dockAfter','.dock']]) {
      const el = document.querySelector(sel);
      const which = k.endsWith('After') ? '::after' : '::before';
      const cs = getComputedStyle(el, which);
      out.pseudo[k] = { content: cs.content, background: cs.background.slice(0,160), transform: cs.transform, opacity: cs.opacity, height: cs.height, boxShadow: cs.boxShadow.slice(0,160) };
    }
    // gaps between adjacent tap targets
    const taps = [...document.querySelectorAll('.dock a')].map(a => a.getBoundingClientRect());
    out.gaps = taps.slice(1).map((r, i) => Math.round((r.left - taps[i].right) * 100) / 100);
    // page-level
    const main = document.querySelector('main');
    out.mainPadBottom = getComputedStyle(main).paddingBottom;
    out.bodyPadBottom = getComputedStyle(document.body).paddingBottom;
    out.viewportMeta = document.querySelector('meta[name=viewport]')?.content;
    out.docScrollBehavior = getComputedStyle(document.documentElement).scrollBehavior;
    out.htmlOverflowX = document.documentElement.scrollWidth;
    // accent hue census across whole page
    const census = {};
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      for (const prop of ['color','backgroundColor','borderTopColor','fill','stroke']) {
        const v = cs[prop];
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(v);
        if (!m) continue;
        const [r,g,b,a] = [ +m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4] ];
        if (a < 0.2) continue;
        const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
        if (mx - mn < 30) continue; // near-neutral
        const key = `rgb(${r},${g},${b})`;
        census[key] = (census[key] || 0) + 1;
      }
    }
    out.chromaticColors = census;
    return out;
  });
  console.log('==== ' + label + ' ====');
  console.log(JSON.stringify(r, null, 1));
};

await dump('at-top');

// scroll to work section, re-dump active state
await page.evaluate(() => document.getElementById('work').scrollIntoView());
await page.waitForTimeout(900);
const active = await page.evaluate(() => [...document.querySelectorAll('.dock-tab')].map(a => ({ href: a.getAttribute('href'), cls: a.className, ariaCurrent: a.getAttribute('aria-current'), color: getComputedStyle(a).color, bg: getComputedStyle(a).backgroundColor, opacity: getComputedStyle(a).opacity, labelColor: getComputedStyle(a.querySelector('.dock-lb')).color })));
console.log('==== active-state-at-work ====');
console.log(JSON.stringify(active, null, 1));

// what element is under the dock centre / is the dock hit-blocking content?
const probe = await page.evaluate(() => {
  const pts = [[196, 790], [196, 812], [196, 840], [196, 846], [30, 812], [370, 812]];
  return pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return { x, y, el: e ? e.tagName + '.' + (typeof e.className === 'string' ? e.className : '') : null }; });
});
console.log('==== elementFromPoint ====');
console.log(JSON.stringify(probe, null, 1));

// pixel sample of the dock via canvas on a fresh screenshot
const shot = await page.screenshot();
const b64 = shot.toString('base64');
const px = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const at = (x, y) => { const d = g.getImageData(x, y, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; };
  // device px = css*3
  return {
    size: [img.width, img.height],
    pillBg: at(590, 2450),           // between icons, inside pill
    pillBgLeft: at(200, 2500),
    behindPillOutside: at(20, 2450), // outside pill, page bg
    activeChip: at(300, 2400),
    ctaCentre: at(2480 > 0 ? 990 : 0, 2440),
    workLabel: at(400, 2492),
    careerLabel: at(880, 2492),
    pageBgTop: at(590, 1200),
    topEdgeOfPill: at(590, 2340),
    aboveTopEdge: at(590, 2320),
    belowPillBottom: at(590, 2545),
  };
}, b64);
console.log('==== pixels(device px, DPR3) ====');
console.log(JSON.stringify(px, null, 1));

// motion frame diff over dock region
const frames = [];
for (let i = 0; i < 6; i++) frames.push('/home/user/cartridge/cv-site/captures/critic-r1/nav/nav-motion-00' + i + '.png');
const { readFile } = await import('node:fs/promises');
const b64s = await Promise.all(frames.map(async f => (await readFile(f)).toString('base64')));
const diffs = await page.evaluate(async (b64s) => {
  const load = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.getContext('2d').getImageData(0, 2300, im.width, 256); };
  const imgs = [];
  for (const b of b64s) imgs.push(await load(b));
  const res = [];
  for (let i = 1; i < imgs.length; i++) {
    let n = 0, mx = 0;
    const a = imgs[i - 1].data, b = imgs[i].data;
    for (let k = 0; k < a.length; k += 4) for (let c = 0; c < 3; c++) { const d = Math.abs(a[k + c] - b[k + c]); if (d > 2) n++; if (d > mx) mx = d; }
    res.push({ pair: `${i - 1}->${i}`, changedSubpixels: n, maxDelta: mx });
  }
  return res;
}, b64s);
console.log('==== dock-region motion diff ====');
console.log(JSON.stringify(diffs, null, 1));

await browser.close();
