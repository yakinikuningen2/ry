import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
await mkdir(resolve(dist, 'assets'), { recursive: true });
await rm(resolve(dist, 'history.js'), { force: true });
const files = ['index.html', 'styles.css', 'app.js', 'generator.js', 'assets/favicon.svg', 'assets/ogp.png'];
for (const file of files) await copyFile(resolve(root, file), resolve(dist, file));
const configuredOrigin = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
if (configuredOrigin) {
  const url = new URL(configuredOrigin.includes('://') ? configuredOrigin : `https://${configuredOrigin}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('SITE_URL must be an HTTP(S) URL.');
  url.search = ''; url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const image = escape(new URL('assets/ogp.png', url).href);
  let html = await readFile(resolve(dist, 'index.html'), 'utf8');
  html = html.replaceAll('content="/assets/ogp.png"', `content="${image}"`);
  html = html.replace('</head>', `  <meta property="og:url" content="${escape(url.href)}">\n  <link rel="canonical" href="${escape(url.href)}">\n</head>`);
  await writeFile(resolve(dist, 'index.html'), html);
}
console.log('Static site ready: dist/');
if (!configuredOrigin) console.log('Local build: set SITE_URL to embed an absolute OGP/canonical URL. Vercel sets the deployment origin automatically.');
