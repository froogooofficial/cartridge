// Convert the built site into an Artifact-ready fragment: the publish wrapper
// supplies <!doctype>/<html>/<head>/<body>, so those must not appear here.
import { readFile, writeFile } from 'node:fs/promises';
const src = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
const style = src.match(/<style>([\s\S]*?)<\/style>/)[1];
const script = (src.match(/<script>([\s\S]*?)<\/script>/) || [null, ''])[1];
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/<script>[\s\S]*?<\/script>/g, '')
  .trim();
const title = (src.match(/<title>([\s\S]*?)<\/title>/) || [null, 'CV'])[1];

// The page is a deliberate single-theme design (near-black, one accent). Pin the
// tokens against the viewer's theme toggle so a light-mode viewer still sees the
// design as it was judged, rather than a half-inverted version of it.
const out = `<title>${title}</title>
<style>
:root, :root[data-theme="light"], :root[data-theme="dark"] { color-scheme: dark; }
html, body { background: #08090A; }
${style}
</style>
${body}
<script>${script}</script>
`;
await writeFile(new URL('../progress/site.html', import.meta.url), out);
console.log(`artifact fragment written — ${(Buffer.byteLength(out)/1024).toFixed(1)} KB`);
