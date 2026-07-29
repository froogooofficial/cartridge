import { chromium } from 'playwright';
import { contextOptions, CPU_THROTTLE } from './profile.mjs';
const b = await chromium.launch({args:['--force-device-scale-factor=3']});
const ctx = await b.newContext(contextOptions());
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:CPU_THROTTLE});

// sample the hero entrance from first paint
await p.goto('http://127.0.0.1:4173/',{waitUntil:'commit'});
const samples=[];
for(let i=0;i<26;i++){
  const s = await p.evaluate(()=>{
    const g=(sel)=>{const e=document.querySelector(sel); if(!e) return null; const c=getComputedStyle(e); return {o:c.opacity, t:c.transform, cls:e.className};};
    return {t:Math.round(performance.now()), h1:g('#hero .hero-display'), lede:g('#hero .hero-lede'), act:g('#hero .hero-actions')};
  }).catch(()=>null);
  if(s) samples.push(s);
  await p.waitForTimeout(60);
}
console.log('ENTRANCE');
for(const s of samples) console.log(JSON.stringify(s));

// measure chars per line of lede + accent usage + luminance probe of top-right
await p.waitForTimeout(1000);
const m = await p.evaluate(()=>{
  const lede=document.querySelector('#hero .hero-lede');
  const r=new Range(); const lines=[];
  // count rendered line boxes
  const walker=document.createTreeWalker(lede,NodeFilter.SHOW_TEXT);
  let full=''; const nodes=[];
  while(walker.nextNode()){nodes.push(walker.currentNode); full+=walker.currentNode.textContent;}
  // measure line rects
  const rr=new Range(); rr.selectNodeContents(lede);
  const rects=[...rr.getClientRects()].filter(x=>x.height>5);
  // chars per line via per-char rect grouping
  const perLine={};
  for(const n of nodes){
    for(let i=0;i<n.textContent.length;i++){
      const cr=document.createRange(); cr.setStart(n,i); cr.setEnd(n,i+1);
      const b=cr.getBoundingClientRect(); if(!b.height) continue;
      const key=Math.round(b.top/5)*5; perLine[key]=(perLine[key]||0)+1;
    }
  }
  const counts=Object.values(perLine);
  // accent occurrences in hero
  const accent=[];
  for(const e of document.querySelectorAll('#hero, #hero *')){
    const c=getComputedStyle(e);
    for(const prop of ['color','backgroundColor','borderTopColor','outlineColor']){
      const v=c[prop];
      if(/^rgba?\((1[0-2][0-9]|9[0-9]),\s*(1[0-9][0-9]),\s*(2[0-9][0-9])/.test(v)) accent.push(e.tagName+'.'+e.className+' '+prop+'='+v);
    }
  }
  // background gradient on hero
  const hs=getComputedStyle(document.querySelector('#hero'));
  const bodyBefore = getComputedStyle(document.body,'::before').backgroundImage;
  return {ledeLineCounts:counts, ledeText:full.length, rectsCount:rects.length, accent,
    heroBgImage:hs.backgroundImage, bodyBeforeBg:bodyBefore.slice(0,300),
    fullText:full};
});
console.log('MEASURE', JSON.stringify(m,null,1));

// reduced motion
const ctx2 = await b.newContext({...contextOptions(), reducedMotion:'reduce'});
const p2 = await ctx2.newPage();
await p2.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
const rm = await p2.evaluate(()=>{
  const e=document.querySelector('#hero .hero-lede'); const c=getComputedStyle(e);
  return {transition:c.transition, opacity:c.opacity, transform:c.transform};
});
console.log('REDUCED', JSON.stringify(rm));
await b.close();
