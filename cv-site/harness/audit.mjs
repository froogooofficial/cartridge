// Hard-floor audit: tap targets, scroll jank at 60fps, layout shift, overflow.
//
//   node harness/audit.mjs <url> [outJson]
//
// Exits non-zero if any hard floor fails.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { contextOptions, CPU_THROTTLE, VIEWPORT } from './profile.mjs';

const [url, outJson] = process.argv.slice(2);
if (!url) {
  console.error('usage: audit.mjs <url> [outJson]');
  process.exit(1);
}

const MIN_TAP = 44; // CSS px, per Apple HIG and WCAG 2.2 target size.
const FRAME_BUDGET = 1000 / 60; // 16.67ms

const run = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptions());
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(1200);

  // --- 1. Tap targets -----------------------------------------------------
  const tapTargets = await page.evaluate((min) => {
    const sel = 'a, button, [role="button"], [role="link"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // An element can meet the floor via its own box or a padded hit area
      // expressed through a ::before/::after overlay; measure the union.
      let w = r.width, h = r.height;
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content === 'none') continue;
        if (ps.position !== 'absolute') continue;
        const px = (v) => (v === 'auto' ? 0 : parseFloat(v) || 0);
        const ew = r.width + Math.abs(px(ps.left)) + Math.abs(px(ps.right));
        const eh = r.height + Math.abs(px(ps.top)) + Math.abs(px(ps.bottom));
        w = Math.max(w, ew); h = Math.max(h, eh);
      }
      if (w + 0.5 < min || h + 0.5 < min) {
        out.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 48),
          cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 60) : '',
          w: Math.round(w * 10) / 10,
          h: Math.round(h * 10) / 10,
        });
      }
    }
    return out;
  }, MIN_TAP);

  // --- 2. Horizontal overflow --------------------------------------------
  const overflow = await page.evaluate((vw) => {
    const bad = [];
    if (document.documentElement.scrollWidth > vw + 1) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 || r.left < -1) {
          const s = getComputedStyle(el);
          if (s.position === 'fixed' && s.visibility === 'hidden') continue;
          bad.push({
            tag: el.tagName.toLowerCase(),
            cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
            left: Math.round(r.left),
            right: Math.round(r.right),
          });
        }
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, viewport: vw, offenders: bad.slice(0, 12) };
  }, VIEWPORT.width);

  // --- 3. Scroll jank -----------------------------------------------------
  // Drive a real touch fling and count frames that missed the 16.67ms budget.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.__frames = [];
    window.__shift = 0;
    let last = performance.now();
    const tick = (now) => {
      window.__frames.push(now - last);
      last = now;
      window.__raf = requestAnimationFrame(tick);
    };
    window.__raf = requestAnimationFrame(tick);
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shift += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration));
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });

  const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const flicks = Math.max(3, Math.ceil(docHeight / VIEWPORT.height));
  for (let i = 0; i < flicks; i++) {
    await cdp.send('Input.synthesizeScrollGesture', {
      x: Math.round(VIEWPORT.width / 2),
      y: Math.round(VIEWPORT.height * 0.78),
      yDistance: -VIEWPORT.height,
      speed: 1800,
      gestureSourceType: 'touch',
      preventFling: false,
    });
    await page.waitForTimeout(320);
  }

  const perf = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    return { frames: window.__frames, cls: window.__shift, longTasks: window.__longTasks || [] };
  });

  // Drop the first few frames (observer warm-up) and any absurd gap from an idle pause.
  const frames = perf.frames.slice(3).filter((f) => f < 400);
  const dropped = frames.filter((f) => f > FRAME_BUDGET * 1.5).length;
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
  const longest = sorted.length ? sorted[sorted.length - 1] : 0;
  const jankPct = frames.length ? (dropped / frames.length) * 100 : 0;

  await context.close();
  await browser.close();

  const report = {
    url,
    tapTargets: { min: MIN_TAP, failures: tapTargets, pass: tapTargets.length === 0 },
    overflow: { ...overflow, pass: overflow.scrollWidth <= VIEWPORT.width + 1 },
    scroll: {
      frameCount: frames.length,
      droppedFrames: dropped,
      jankPct: Math.round(jankPct * 100) / 100,
      p95FrameMs: Math.round(p95 * 100) / 100,
      longestFrameMs: Math.round(longest * 100) / 100,
      // "No jank at 60fps": under 1% dropped frames and no frame over 32ms (2x budget).
      pass: jankPct < 1 && longest <= FRAME_BUDGET * 2,
    },
    cls: { value: Math.round(perf.cls * 1000) / 1000, pass: perf.cls < 0.1 },
    longTasks: perf.longTasks,
  };
  report.pass =
    report.tapTargets.pass && report.overflow.pass && report.scroll.pass && report.cls.pass;

  const json = JSON.stringify(report, null, 2);
  if (outJson) await writeFile(outJson, json);
  console.log(json);
  process.exit(report.pass ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
