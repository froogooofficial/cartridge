import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const file = 'data:image/png;base64,' + (await import('node:fs')).readFileSync('/home/user/cartridge/cv-site/captures/critic-r1/hero/hero-viewport-000.png').toString('base64');
await p.goto('about:blank');
const res = await p.evaluate(async (src)=>{
  const img = new Image(); img.src = src;
  await img.decode();
  const c = document.createElement('canvas'); c.width=img.width; c.height=img.height;
  const g = c.getContext('2d'); g.drawImage(img,0,0);
  const px=(x,y)=>{const d=g.getImageData(x,y,1,1).data; return [d[0],d[1],d[2]];};
  const avg=(x0,y0,w,h)=>{const d=g.getImageData(x0,y0,w,h).data; let r=0,gg=0,bb=0,n=d.length/4;
    for(let i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];bb+=d[i+2];}
    return [Math.round(r/n),Math.round(gg/n),Math.round(bb/n)];};
  const maxLum=(x0,y0,w,h)=>{const d=g.getImageData(x0,y0,w,h).data;let m=0;
    for(let i=0;i<d.length;i+=4){const l=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]; if(l>m)m=l;} return Math.round(m);};
  return {
    size:[img.width,img.height],
    topLeft: avg(0,0,120,120),
    topRight: avg(img.width-120,0,120,120),
    topRightMaxLum: maxLum(img.width-160,0,160,160),
    midLeft: avg(0,900,120,120),
    bottomLeft: avg(0,2100,120,120),
    bottomRight: avg(img.width-120,2100,120,120),
    center: avg(500,1200,120,120),
    // gradient span: sample a vertical column x=30 every 200px
    column: [0,200,400,600,800,1000,1200,1400,1600,1800,2000,2200].map(y=>[y,avg(20,y,40,40)]),
    // horizontal at y=60
    rowTop: [0,200,400,600,800,1000].map(x=>[x,avg(x,40,40,40)]),
    navPill: avg(60,2300,60,40),
    fabColor: px(1020,2320),
    ctaColor: px(200,1890),
  };
}, file);
console.log(JSON.stringify(res,null,1));
await b.close();
