import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('all application element IDs exist once in the HTML', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'IDs must be unique');
  for (const [, id] of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(id), `Missing #${id}`);
  assert.ok(html.includes('lang="ja"'));
  assert.ok(html.includes('name="viewport"'));
  assert.ok(!html.includes('maxlength='));
  assert.ok(html.includes('property="og:image"'));
  assert.ok(!app.includes('innerHTML'));
});

test('referenced local files exist, and the OGP image is a 1200×630 PNG', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const [, path] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) await access(new URL(`../${path}`, import.meta.url));
  const png = await readFile(new URL('../assets/ogp.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
