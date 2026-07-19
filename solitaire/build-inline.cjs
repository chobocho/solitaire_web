// =========================================================================
//  Shared inliner for build.sh / build.bat
//  Merges the JS bundle, CSS, favicon and all images into ONE index.html.
//  Usage: node build-inline.cjs <bundle.js> <index.html> <style.css> <imgDir> <out.html>
// =========================================================================
const fs = require('fs');
const path = require('path');

const [ , , bundlePath, htmlPath, cssPath, imgDir, outPath ] = process.argv;

// --- collect images as data URIs (keyed by filename without extension) ---
const MIME = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
               '.gif':'image/gif', '.webp':'image/webp', '.svg':'image/svg+xml' };
const images = {};
for (const f of fs.readdirSync(imgDir)) {
  const ext = path.extname(f).toLowerCase();
  const mime = MIME[ext];
  if (!mime) continue;
  const b64 = fs.readFileSync(path.join(imgDir, f)).toString('base64');
  images[path.basename(f, ext)] = `data:${mime};base64,${b64}`;
}

// --- bundle: make loadImages() prefer the embedded image map ---
let bundle = fs.readFileSync(bundlePath, 'utf8');
const before = bundle;
bundle = bundle.replace(
  /img\.src\s*=\s*baseUrl\s*\+\s*name\s*\+\s*['"]\.png['"];/,
  'img.src = (globalThis.__IMG__ && globalThis.__IMG__[name]) || (baseUrl + name + ".png");'
);
if (bundle === before) {
  console.error('WARNING: loadImages image-src line not found; images may not inline.');
}

const css = fs.readFileSync(cssPath, 'utf8');

// --- rewrite index.html: drop external <link>/<script>, inline everything ---
let html = fs.readFileSync(htmlPath, 'utf8');

html = html.replace(
  /<link\s+rel="icon"[^>]*>/i,
  `<link rel="icon" href="${images['icon'] || ''}">`
);
html = html.replace(
  /<link\s+rel="stylesheet"[^>]*>/i,
  `<style>\n${css}\n</style>`
);
html = html.replace(
  /<script\s+type="module"[^>]*><\/script>/i,
  `<script>globalThis.__IMG__=${JSON.stringify(images)};</script>\n<script>\n${bundle}\n</script>`
);

fs.writeFileSync(outPath, html);

const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`       ${Object.keys(images).length} images inlined, output ${kb} KB`);
