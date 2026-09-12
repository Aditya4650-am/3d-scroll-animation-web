import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Inlines the real first frame (frame_001.png) as a base64 data-URI background
 * directly into the served HTML document.
 *
 * Why: in a token-enforced preview proxy, sub-resource image requests can be
 * blocked even though the HTML document loads. By embedding the actual first
 * frame in the HTML itself we guarantee the spaceship is visible with ZERO
 * network requests — the data URI rides along with the authenticated document.
 *
 * The full-res frames are still used for the interactive canvas animation.
 */
function inlineFirstFrame() {
  const framePath = join(
    process.cwd(),
    'public',
    'frames',
    'frame_001.png',
  );
  let dataUri = null;
  try {
    const bytes = readFileSync(framePath);
    dataUri = `data:image/png;base64,${bytes.toString('base64')}`;
    // eslint-disable-next-line no-console
    console.log(
      `[vite:inline-first-frame] inlined first frame (${Math.round(
        bytes.length / 1024,
      )} KB) into HTML`,
    );
  } catch {
    // Frames not extracted yet (e.g. first run) — leave the CSS placeholder.
    dataUri = null;
  }

  return {
    name: 'inline-first-frame',
    transformIndexHtml(html) {
      const style = dataUri
        ? `<style>.spaceship-hero-first-frame{position:fixed;inset:0;z-index:0;` +
          `pointer-events:none;background:#000 url('${dataUri}') center/cover no-repeat;}</style>`
        : '';
      const element = dataUri
        ? '<div class="spaceship-hero-first-frame"></div>'
        : '';
      // Inject the visible element + style just before the closing </body> so
      // they apply immediately (data URI = no extra network request).
      return html.replace('</body>', `${style}${element}</body>`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [inlineFirstFrame()],
  server: {
    host: true,
    // The live preview is served from a sandboxed proxy host, so accept any
    // dev host in this environment.
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
});
