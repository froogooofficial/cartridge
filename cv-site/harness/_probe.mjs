import { chromium } from 'playwright';
import { contextOptions, CPU_THROTTLE } from '/home/user/cartridge/cv-site/harness/profile.mjs';
const b = await chromium.launch({args:['--force-device-scale-factor=3']});
const ctx = await b.newContext(contextOptions());
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:CPU_THROTTLE});
await p.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
await p.waitForTimeout(1500);
const out = await p.evaluate(() => {
  const hero = document.getElementById('hero');
  const res = {heroHTML: hero.outerHTML.slice(0,4000)};
  const px = (e)=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return{
    sel:e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).join('.'):''),
    text:(e.textContent||'').trim().slice(0,60), fs:s.fontSize, fw:s.fontWeight, lh:s.lineHeight, ls:s.letterSpacing,
    color:s.color, bg:s.backgroundColor, x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
    mt:s.marginTop, mb:s.marginBottom, pt:s.paddingTop, pb:s.paddingBottom, radius:s.borderRadius, border:s.border,
    transition:s.transition, animation:s.animationName, opacity:s.opacity, transform:s.transform, textTransform:s.textTransform }};
  res.all = [...hero.querySelectorAll('*')].map(px);
  res.heroBox = px(hero);
  res.bodyBg = getComputedStyle(document.body).backgroundColor;
  res.htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  res.docScrollWidth = document.documentElement.scrollWidth;
  // sections
  res.sections = [...document.querySelectorAll('section,[id]')].map(e=>({id:e.id,tag:e.tagName,y:Math.round(e.getBoundingClientRect().y),h:Math.round(e.getBoundingClientRect().height)}));
  // element at top-right region
  res.topRight = document.elementFromPoint(360, 30)?.outerHTML.slice(0,200);
  res.viewportMeta = document.querySelector('meta[name=viewport]')?.content;
  res.taps = [...document.querySelectorAll('a,button,[role=button]')].map(e=>{const r=e.getBoundingClientRect();return{t:(e.textContent||'').trim().slice(0,20),aria:e.getAttribute('aria-label'),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y)}});
  return res;
});
console.log(JSON.stringify(out,null,1));
await b.close();
