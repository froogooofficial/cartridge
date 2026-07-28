// Lighthouse mobile performance run against the mid-tier Android profile.
//
//   node harness/lh.mjs <url> [outJson]
//
// Exits non-zero if performance < 95.
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import { writeFile } from 'node:fs/promises';

const [url, outJson] = process.argv.slice(2);
if (!url) {
  console.error('usage: lh.mjs <url> [outJson]');
  process.exit(1);
}

const FLOOR = 95;

const run = async () => {
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
  // Lighthouse drives the browser over CDP on its own port.
  const result = await lighthouse(
    url,
    { port: 9222, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices'] },
    // formFactor mobile + Moto G Power emulation + simulated Slow 4G are the preset defaults.
    { extends: 'lighthouse:default', settings: { formFactor: 'mobile', screenEmulation: { mobile: true, width: 393, height: 852, deviceScaleFactor: 3, disabled: false } } }
  );
  await browser.close();

  const lhr = result.lhr;
  const a = lhr.audits;
  const num = (id) => (a[id] ? a[id].numericValue : null);
  const report = {
    url,
    performance: Math.round(lhr.categories.performance.score * 100),
    accessibility: Math.round(lhr.categories.accessibility.score * 100),
    bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
    metrics: {
      FCP: num('first-contentful-paint'),
      LCP: num('largest-contentful-paint'),
      TBT: num('total-blocking-time'),
      CLS: num('cumulative-layout-shift'),
      SI: num('speed-index'),
      TTI: num('interactive'),
    },
    opportunities: Object.values(a)
      .filter((x) => x.details?.type === 'opportunity' && x.numericValue > 50)
      .map((x) => ({ id: x.id, title: x.title, savingsMs: Math.round(x.numericValue) }))
      .sort((x, y) => y.savingsMs - x.savingsMs)
      .slice(0, 10),
    failedA11y: Object.values(a)
      .filter((x) => x.score === 0 && x.scoreDisplayMode === 'binary' && lhr.categories.accessibility.auditRefs.some((r) => r.id === x.id))
      .map((x) => x.id),
  };
  report.pass = report.performance >= FLOOR;

  const json = JSON.stringify(report, null, 2);
  if (outJson) await writeFile(outJson, json);
  console.log(json);
  process.exit(report.pass ? 0 : 1);
};

run().catch((e) => {
  console.error(e);
  process.exit(2);
});
