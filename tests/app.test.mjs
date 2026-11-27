// Integration tests run the actual app module with a small DOM adapter. They
// verify application behavior, not browser layout or native clipboard support.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscordText } from '../generator.js';
const LEGACY_HISTORY_KEY = 'katteni-ryakusuna.history.v1';

class Element {
  constructor(id = '') {
    this.id = id; this.value = ''; this.textContent = ''; this.hidden = false;
    this.disabled = false; this.max = '1'; this.min = '1'; this.dataset = {};
    this.children = []; this.attrs = {}; this.listeners = new Map();
    this.classes = new Set();
    this.classList = { toggle: (name, value) => { if (value) this.classes.add(name); else this.classes.delete(name); }, remove: name => this.classes.delete(name) };
  }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(listener); }
  async dispatch(name, extra = {}) {
    const event = { prevented: false, preventDefault() { this.prevented = true; }, ...extra };
    for (const listener of this.listeners.get(name) || []) await listener(event);
    return event;
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  focus() { document.activeElement = this; }
  querySelector() { return new Element('svg'); }
  cloneNode() { return new Element(this.id); }
  select() { this.selected = true; }
  setSelectionRange() {}
  remove() { this.removed = true; }
  scrollIntoView() { this.scrolled = true; }
}

let counter = 0;
async function setup({ store = new Map(), denied = false, clipboardDenied = false, mobile = false } = {}) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  get('result-actions').hidden = true;
  get('result-panel').hidden = true;
  const listeners = {};
  const writes = [];
  const clipboard = [];
  const localStorage = { getItem(key) { if (denied) throw Error('denied'); return store.get(key) ?? null; }, setItem(key, value) { if (denied) throw Error('denied'); store.set(key, value); }, removeItem(key) { if (denied) throw Error('denied'); store.delete(key); } };
  globalThis.document = {
    getElementById: get,
    querySelectorAll: () => [],
    createElement: tag => new Element(tag),
    body: new Element('body'), activeElement: get('word'),
    execCommand: command => { writes.push(command); return true; }
  };
  globalThis.window = { localStorage, confirm: () => true, addEventListener: (name, handler) => { listeners[name] = handler; } };
  globalThis.location = { href: 'https://example.com/play/?private=test#result', protocol: 'https:' };
  globalThis.matchMedia = () => ({ matches: mobile });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { if (clipboardDenied) throw Error('denied'); clipboard.push(text); } } } });
  await import(`../app.js?test=${counter++}`);
  return { get, store, clipboard, writes, listeners, async input(text) { get('word').value = text; await get('word').dispatch('input'); }, async submit() { return get('generator-form').dispatch('submit'); } };
}

test('application: automatic length, regenerate, copy and encoded X share', async () => {
  const app = await setup();
  assert.equal(app.get('result-actions').hidden, true);
  assert.equal(app.get('result-panel').hidden, true);
  await app.input('ポケットモンスター');
  await app.submit();
  const first = app.get('result-word').textContent;
  const after = Array.from(first).length;
  assert.ok(after >= 1 && after <= 6);
  assert.equal(app.get('result-actions').hidden, false);
  assert.equal(app.get('result-panel').hidden, false);
  assert.equal(app.get('before-count').textContent, 9);
  assert.equal(app.get('after-count').textContent, after);
  assert.equal(app.get('reduction-rate').textContent, Math.round((9 - after) / 9 * 100));
  await app.get('regenerate').dispatch('click');
  const second = app.get('result-word').textContent;
  assert.notEqual(second, first);
  await app.get('copy-result').dispatch('click');
  assert.deepEqual(app.clipboard, [second]);
  const share = new URL(app.get('share-x').href);
  assert.ok(share.searchParams.get('text').includes(`「${second}」`));
  assert.equal(share.searchParams.get('url'), 'https://example.com/play/');
});

test('application: validation, clear and IME handling', async () => {
  const app = await setup();
  for (const value of ['', ' \t　']) {
    await app.input(value); await app.submit();
    assert.equal(app.get('form-error').hidden, false);
    assert.equal(app.get('result-panel').hidden, true);
  }
  await app.input('東京');
  await app.get('word').dispatch('compositionstart');
  const key = await app.get('word').dispatch('keydown', { key: 'Enter', isComposing: true });
  assert.equal(key.prevented, true);
  await app.submit();
  assert.equal(app.get('result-panel').hidden, true);
  await app.get('word').dispatch('compositionend');
  await app.submit();
  assert.equal(app.get('result-panel').hidden, false);
  await app.get('clear-input').dispatch('click');
  assert.equal(app.get('word').value, '');
  assert.equal(app.get('clear-input').hidden, true);
});

test('application: one-character input displays and can be copied and shared', async () => {
  const app = await setup();
  for (const word of ['あ', '👨‍👩‍👧‍👦', 'か\u3099']) {
    await app.input(word); await app.submit();
    assert.equal(app.get('form-error').hidden, true);
    assert.equal(app.get('result-word').textContent, word);
    assert.equal(app.get('before-count').textContent, 1);
    assert.equal(app.get('after-count').textContent, 1);
    assert.equal(app.get('reduction-rate').textContent, 0);
    assert.equal(app.get('result-notice').hidden, true);
    assert.equal(app.get('result-notice').textContent, '');
    await app.get('regenerate').dispatch('click');
    assert.equal(app.get('result-word').textContent, word);
    assert.equal(app.get('result-notice').hidden, true);
    assert.equal(app.get('result-notice').textContent, '');
    await app.get('copy-result').dispatch('click');
    assert.equal(app.clipboard.at(-1), word);
    assert.ok(new URL(app.get('share-x').href).searchParams.get('text').includes(`「${word}」`));
  }
});

test('application: Discord copies a share-ready message for the current result', async () => {
  const app = await setup();
  await app.get('share-discord').dispatch('click');
  assert.equal(app.clipboard.length, 0);
  await app.input('ポケットモンスター'); await app.submit();
  for (let i = 0; i < 2; i++) {
    const result = app.get('result-word').textContent;
    await app.get('share-discord').dispatch('click');
    assert.equal(app.clipboard.at(-1), buildDiscordText({ word: 'ポケットモンスター', result }, location.href));
    assert.ok(app.get('toast').textContent.includes('Discord用にコピーしました'));
    await app.get('regenerate').dispatch('click');
  }
});

test('application: input beyond 100 characters and the former HTML limit works', async () => {
  const app = await setup();
  for (const size of [101, 4097, 10000]) {
    const word = '長'.repeat(size);
    await app.input(word); await app.submit();
    assert.equal(app.get('form-error').hidden, true);
    assert.equal(app.get('original-word').textContent, word);
    assert.equal(app.get('before-count').textContent, size);
    assert.ok(app.get('after-count').textContent > 6 && app.get('after-count').textContent < size);
    const previous = app.get('result-word').textContent;
    await app.get('regenerate').dispatch('click');
    assert.notEqual(app.get('result-word').textContent, previous);
  }
});

test('application: removes old history only, and never persists new words', async () => {
  const store = new Map([['other-project', 'keep'], [LEGACY_HISTORY_KEY, '[{"word":"東京","result":"東"}]']]);
  let app = await setup({ store });
  assert.equal(store.has(LEGACY_HISTORY_KEY), false);
  await app.input('ポケットモンスター'); await app.submit();
  for (let i = 0; i < 23; i++) await app.get('regenerate').dispatch('click');
  assert.deepEqual([...store], [['other-project', 'keep']]);
  app = await setup({ store });
  assert.equal(app.get('result-panel').hidden, true);
  assert.equal(store.get('other-project'), 'keep');
});

test('application: rejected clipboard uses fallback, unavailable storage keeps generation working', async () => {
  const app = await setup({ denied: true, clipboardDenied: true, mobile: true });
  await app.input('ポケットモンスター'); await app.submit();
  assert.ok(app.get('result-word').textContent);
  assert.notEqual(app.get('result-panel').scrolled, true);
  await app.get('copy-result').dispatch('click');
  assert.deepEqual(app.writes, ['copy']);
  assert.equal(app.get('toast').textContent, '略語をコピーしました。');
  await app.get('share-discord').dispatch('click');
  assert.deepEqual(app.writes, ['copy', 'copy']);
  assert.equal(document.body.children.at(-1).value, buildDiscordText({ word: 'ポケットモンスター', result: app.get('result-word').textContent }, location.href));
  assert.ok(app.get('toast').textContent.includes('Discord用にコピーしました'));
});

test('application: HTML-like input stays literal text in result', async () => {
  const app = await setup();
  const payload = '<img/src=x/onerror=alert(1)>';
  await app.input(payload); await app.submit();
  assert.equal(app.get('original-word').textContent, payload);
  assert.equal(app.get('original-word').children.length, 0);
});
