// inline-build.mjs
// Post-processes a Vite production build so that ALL JavaScript and CSS are
// inlined into a single, self-contained index.html. Because the frames are
// already inlined as base64 data-URIs in the JS bundle, the resulting page is a
// single HTML request with zero external sub-resources.
//
// This matters in token-enforced preview proxies that can block sub-resource
// requests (images, scripts): a fully-inlined document has nothing external to
// block, so the app always mounts and the scroll animation always runs.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(ROOT, 'dist');
const htmlPath = join(distDir, 'index.html');

let html = readFileSync(htmlPath, 'utf-8');

// Inline CSS <link> tags.
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (m, href) => {
  const cssPath = join(distDir, href.replace(/^\.?\//, ''));
  const css = readFileSync(cssPath, 'utf-8');
  return `<style>${css}</style>`;
});

// Inline JS <script> tags.
html = html.replace(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (m, src) => {
  const jsPath = join(distDir, src.replace(/^\.?\//, ''));
  const js = readFileSync(jsPath, 'utf-8');
  return `<script type="module">${js}</script>`;
});

writeFileSync(htmlPath, html, 'utf-8');
console.log(
  `[inline-build] inlined JS + CSS into index.html (${Math.round(
    readFileSync(htmlPath, 'utf-8').length / 1024,
  )} KB).`,
);
