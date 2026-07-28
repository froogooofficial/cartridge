// Compose site/index.html from site/parts/*, inlining all CSS and JS.
// Each part is owned by exactly one builder, so parallel builders never collide.
//   node harness/build.mjs
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('../site', import.meta.url).pathname.replace(/\/$/, '');
const read = async (p, fallback = '') => { try { return await readFile(p, 'utf8'); } catch { return fallback; } };
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

const order = JSON.parse(await read(join(ROOT, 'parts', 'order.json'), '[]'));
const content = JSON.parse(await read(join(ROOT, 'content.json'), '{}'));

// {{person.name}} / {{#each experience}}…{{/each}} — a deliberately tiny template
// language so parts stay plain HTML a critic can read.
const resolve = (path, scope) =>
  path.split('.').reduce((o, k) => (o == null ? o : o[k]), scope);

function render(tpl, scope) {
  // Blocks first (nested-safe via lazy inner match).
  tpl = tpl.replace(/\{\{#each ([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, path, body) => {
    const arr = resolve(path, scope) || [];
    return arr
      .map((item, i) =>
        render(body, { ...scope, ...(typeof item === 'object' ? item : {}), this: item, '@index': i, '@first': i === 0, '@last': i === arr.length - 1 })
      )
      .join('');
  });
  tpl = tpl.replace(/\{\{#if ([\w.@]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, path, body) =>
    resolve(path, scope) ? render(body, scope) : ''
  );
  tpl = tpl.replace(/\{\{\{([\w.@]+)\}\}\}/g, (_, path) => String(resolve(path, scope) ?? ''));
  tpl = tpl.replace(/\{\{([\w.@]+)\}\}/g, (_, path) => {
    const v = resolve(path, scope);
    return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  });
  return tpl;
}

const parts = [];
for (const name of order) {
  const dir = join(ROOT, 'parts', name);
  if (!(await exists(dir))) { console.warn(`  ! missing part: ${name}`); continue; }
  parts.push({
    name,
    html: render(await read(join(dir, `${name}.html`)), content),
    css: await read(join(dir, `${name}.css`)),
    js: await read(join(dir, `${name}.js`)),
  });
}

const tokens = await read(join(ROOT, 'tokens.css'));
const base = await read(join(ROOT, 'base.css'));
const runtime = await read(join(ROOT, 'runtime.js'));

const minCss = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();

const css = minCss([tokens, base, ...parts.map((p) => p.css)].join('\n'));
const js = [runtime, ...parts.map((p) => p.js)].filter(Boolean).join('\n');

const person = content.person || {};
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${person.name || 'CV'} — ${person.title || ''}</title>
<meta name="description" content="${(person.summary || '').slice(0, 155)}">
<meta name="theme-color" content="#08090A">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230A0B0D'/%3E%3Ctext x='16' y='22' font-family='system-ui' font-size='16' font-weight='700' fill='%23F7F8F8' text-anchor='middle'%3E${(person.name || 'CV').split(' ').map((w) => w[0]).join('').slice(0, 2)}%3C/text%3E%3C/svg%3E">
<style>${css}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<main id="main">
${parts.map((p) => `<!-- part:${p.name} -->\n${p.html}`).join('\n')}
</main>
${js ? `<script>${js}</script>` : ''}
</body>
</html>
`;

await writeFile(join(ROOT, 'index.html'), html);
const bytes = Buffer.byteLength(html);
console.log(`built site/index.html — ${parts.length} parts, ${(bytes / 1024).toFixed(1)} KB (css ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB, js ${(Buffer.byteLength(js) / 1024).toFixed(1)} KB)`);
for (const p of parts) console.log(`   · ${p.name}`);
