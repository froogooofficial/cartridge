import { chromium } from 'playwright';
import { contextOptions, CPU_THROTTLE } from './profile.mjs';
const browser = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
const context = await browser.newContext(contextOptions());
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(900);
console.log(JSON.stringify(await page.evaluate(() => ({
  strokes: [...document.querySelectorAll('.dock svg')].map(s => ({ owner: s.closest('a').className, stroke: getComputedStyle(s).strokeWidth, attr: s.getAttribute('stroke-width'), box: s.getBoundingClientRect().width })),
  navIds: [...document.querySelectorAll('nav, .dock-shell')].map(e => ({ tag: e.tagName, id: e.id, cls: String(e.className) })),
  ctaHasText: document.querySelector('.dock-cta').textContent.trim(),
  ctaAria: document.querySelector('.dock-cta').getAttribute('aria-label'),
  ctaHref: document.querySelector('.dock-cta').getAttribute('href'),
  otherMailto: [...document.querySelectorAll('a[href^=mailto]')].map(a => ({ cls: String(a.className), txt: a.textContent.trim().slice(0,20) })),
  sectionsOnPage: [...document.querySelectorAll('main > section')].map(s => s.id),
  scrollListeners: typeof window.onscroll,
}), null, 1)));
await browser.close();
