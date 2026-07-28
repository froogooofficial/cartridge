// Capture screenshots at several scroll depths + a screen recording of a thumb-scroll.
//
//   node harness/capture.mjs <url> <outDir> [label]
//
// Emits: <outDir>/<label>-000.png ... , <outDir>/<label>-scroll.webm, <outDir>/<label>.json
import { chromium } from 'playwright';
import { mkdir, rm, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contextOptions, CPU_THROTTLE, VIEWPORT } from './profile.mjs';

const [url, outDir, label = 'ours'] = process.argv.slice(2);
if (!url || !outDir) {
  console.error('usage: capture.mjs <url> <outDir> [label]');
  process.exit(1);
}

// Thumb-scroll: a real flick has a fast start and an eased tail, not a linear ramp.
// Modelled as a sequence of touch moves with decaying deltas.
async function thumbFlick(page, distance = 900) {
  const startY = VIEWPORT.height * 0.78;
  const steps = 26;
  await page.touchscreen.tap(VIEWPORT.width / 2, startY).catch(() => {});
  const cdp = await page.context().newCDPSession(page);
  // Chrome's synthetic gesture reproduces fling physics including momentum.
  await cdp.send('Input.synthesizeScrollGesture', {
    x: Math.round(VIEWPORT.width / 2),
    y: Math.round(startY),
    yDistance: -distance,
    speed: 1600,
    gestureSourceType: 'touch',
    preventFling: false,
    repeatCount: 0,
  });
  await page.waitForTimeout(220);
  await cdp.detach().catch(() => {});
  return steps;
}

const run = async () => {
  await mkdir(outDir, { recursive: true });
  const videoDir = join(outDir, `.video-${label}`);
  await rm(videoDir, { recursive: true, force: true });
  await mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
  const context = await browser.newContext(
    contextOptions({ recordVideo: { dir: videoDir, size: { width: 393, height: 852 } } })
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  const loadMs = Date.now() - t0;
  // Let entrance animations settle before the first frame.
  await page.waitForTimeout(1400);

  const docHeight = await page.evaluate(
    () => document.documentElement.scrollHeight
  );
  const screens = Math.max(1, Math.ceil(docHeight / VIEWPORT.height));
  const depths = [];

  for (let i = 0; i < screens; i++) {
    const target = Math.min(i * VIEWPORT.height, docHeight - VIEWPORT.height);
    if (i > 0) {
      await thumbFlick(page, VIEWPORT.height);
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target);
      // Settle scroll-driven animations at the resting position.
      await page.waitForTimeout(900);
    }
    const file = join(outDir, `${label}-${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    depths.push({ index: i, scrollY: target, file });
  }

  // Recording pass: return to the top and flick through the whole page.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(700);
  for (let i = 0; i < screens + 1; i++) {
    await thumbFlick(page, VIEWPORT.height * 0.9);
    await page.waitForTimeout(420);
  }
  await page.waitForTimeout(600);

  await context.close();
  await browser.close();

  // Playwright names the video by a random id; rename to a stable path.
  const files = await readdir(videoDir);
  const webm = files.find((f) => f.endsWith('.webm'));
  const videoPath = join(outDir, `${label}-scroll.webm`);
  if (webm) await rename(join(videoDir, webm), videoPath);
  await rm(videoDir, { recursive: true, force: true });

  const manifest = { url, label, loadMs, docHeight, screens, depths, video: webm ? videoPath : null };
  await writeFile(join(outDir, `${label}.json`), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
