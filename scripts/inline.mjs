/**
 * Fold the JS and CSS bundles into index.html so the app ships as a single
 * file.
 *
 * Why: a separate /assets/*.js request has many ways to fail on a real phone —
 * a cached index.html pointing at a deleted hash, a path that resolves wrong,
 * an intermediary that drops it — and every one of them shows as a blank page
 * with nothing to go on. Inlined, there is nothing left to fetch: if the HTML
 * arrives, the app runs.
 *
 * Cost is a ~290 KB HTML document (well compressed in transit) that is no
 * longer separately cacheable. For an app this size that is the right trade.
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const htmlPath = join(DIST, 'index.html');
let html = readFileSync(htmlPath, 'utf8');

// A closing tag inside the payload would end the surrounding element early.
const guard = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

const scriptRe = /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/;
const linkRe = /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/;

const assetPath = (url) => join(DIST, url.replace(/^.*\/assets\//, 'assets/'));

const jsMatch = html.match(scriptRe);
if (!jsMatch) throw new Error('inline: no module script found in index.html');
const js = readFileSync(assetPath(jsMatch[1]), 'utf8');
html = html.replace(scriptRe, () => `<script type="module">\n${guard(js)}\n</script>`);

// Only the bundled stylesheet — the Google Fonts link stays a real request.
const cssMatch = html.match(linkRe);
if (cssMatch && cssMatch[1].includes('/assets/')) {
  const css = readFileSync(assetPath(cssMatch[1]), 'utf8');
  html = html.replace(linkRe, () => `<style>\n${guard(css)}\n</style>`);
}

writeFileSync(htmlPath, html);
if (existsSync(join(DIST, 'assets'))) rmSync(join(DIST, 'assets'), { recursive: true });

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`inlined into a single index.html — ${kb(Buffer.byteLength(html))}`);
if (/src="[^"]*\/assets\//.test(html) || /href="[^"]*\/assets\//.test(html)) {
  throw new Error('inline: index.html still references /assets/');
}
