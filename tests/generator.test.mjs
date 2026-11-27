import test from 'node:test';
import assert from 'node:assert/strict';
import { characters, cleanWord, inspectWord, generateAbbreviation, buildShareUrl, buildDiscordText } from '../generator.js';

function randomSeed(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
function subsequence(source, output) {
  let index = 0;
  // Compare code points as well as graphemes: original code point order must hold.
  const target = Array.from(output);
  for (const char of Array.from(source)) if (char === target[index]) index++;
  return index === target.length;
}

test('Unicode graphemes preserve kanji, combining marks, emoji and flags', () => {
  assert.equal(characters('か\u3099キャー東京ABC👨‍👩‍👧‍👦🇯🇵👍🏽').length, 12);
  assert.equal(characters('👨‍👩‍👧‍👦').length, 1);
  assert.equal(characters('か\u3099').length, 1);
  assert.equal(cleanWord(' 東 京　\nABC\t'), '東京ABC');
});

test('empty and whitespace get useful errors', () => {
  for (const word of ['', ' \t　\n']) {
    assert.ok(inspectWord(word).error);
    assert.throws(() => generateAbbreviation(word), RangeError);
  }
  assert.equal(inspectWord('あい').error, '');
  assert.equal(inspectWord('a'.repeat(100)).error, '');
});

test('long input has no application character limit and preserves Unicode and order', () => {
  const random = randomSeed(137);
  for (const word of ['あ'.repeat(101), 'abcd'.repeat(1025), '東京都'.repeat(4000), '👨‍👩‍👧‍👦か\u3099'.repeat(3000)]) {
    const before = characters(word).length;
    assert.equal(inspectWord(word).error, '');
    const entry = generateAbbreviation(word, { random });
    assert.equal(entry.word, word);
    assert.equal(entry.before, before);
    assert.ok(entry.after > 6 && entry.after < before);
    assert.ok(subsequence(word, entry.result));
    const next = generateAbbreviation(word, { previous: entry.result, random });
    assert.notEqual(next.result, entry.result);
  }
});

test('long names produce varied longer abbreviations instead of a six-character ceiling', () => {
  const word = 'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso';
  const random = randomSeed(818);
  const lengths = new Set();
  let previous = '';
  for (let i = 0; i < 100; i++) {
    const entry = generateAbbreviation(word, { previous, random });
    assert.ok(entry.after > 6 && entry.after < entry.before);
    assert.ok(subsequence(cleanWord(word), entry.result));
    assert.equal(characters(entry.result).length, entry.after);
    assert.notEqual(entry.result, previous);
    lengths.add(entry.after);
    previous = entry.result;
  }
  assert.ok(lengths.size > 15);
});

test('long repeated words still handle unavoidable duplicates and alternative lengths', () => {
  const word = 'あ'.repeat(12000);
  const previous = 'あ'.repeat(3000);
  const fixed = generateAbbreviation(word, { length: 3000, previous, random: () => 0 });
  assert.equal(fixed.after, 3000);
  assert.equal(fixed.repeated, true);
  const automatic = generateAbbreviation(word, { previous, random: () => 0 });
  assert.ok(automatic.after > 6 && automatic.after < automatic.before);
  assert.notEqual(automatic.result, previous);
});

test('one Unicode grapheme is accepted unchanged, with zero reduction', () => {
  for (const word of ['あ', 'ア', '東', 'A', '1', 'か\u3099', '👨‍👩‍👧‍👦', '🇯🇵', '👍🏽']) {
    assert.equal(inspectWord(word).error, '');
    assert.deepEqual(generateAbbreviation(word), { word, result: word, before: 1, after: 1, reduction: 0, repeated: false });
    assert.equal(generateAbbreviation(word, { previous: word }).repeated, true);
    assert.equal(generateAbbreviation(word, { length: 1 }).result, word);
    for (const length of [0, 2]) assert.throws(() => generateAbbreviation(word, { length }), RangeError);
  }
  assert.equal(generateAbbreviation('ポケットモンスター', { random: () => 0 }).after, 1);
});

test('every target length is exact and keeps original character order', () => {
  const random = randomSeed(12345);
  const words = ['マクドナルド', 'ポケットモンスター', 'スターバックス', 'ありがとうございます', '東京ディズニーランド', 'HelloWorld123', 'キャリーパミュパミュ', 'か\u3099き\u3099く\u3099け\u3099', '👨‍👩‍👧‍👦👍🏽🇯🇵😀AB', '🇯A🇵B🇺C🇸', '<img/src=x/onerror=alert(1)>', 'a'.repeat(100)];
  for (const word of words) {
    const before = characters(word).length;
    for (let length = 1; length < before; length++) {
      for (let trial = 0; trial < 12; trial++) {
        const entry = generateAbbreviation(word, { length, random });
        assert.equal(entry.after, length, `${word}: ${length} => ${entry.result}`);
        assert.equal(characters(entry.result).length, length);
        assert.ok(subsequence(word, entry.result));
        assert.equal(entry.before, before);
        assert.equal(entry.reduction, Math.round((before - length) / before * 100));
      }
    }
  }
});

test('automatic mode always shortens and produces varied results', () => {
  const random = randomSeed(42);
  const seen = new Set();
  let previous = '';
  for (let i = 0; i < 500; i++) {
    const entry = generateAbbreviation('ポケットモンスター', { previous, random });
    assert.ok(entry.after >= 1 && entry.after <= 6);
    assert.ok(entry.after < entry.before);
    assert.ok(subsequence(entry.word, entry.result));
    assert.notEqual(entry.result, previous);
    previous = entry.result;
    seen.add(entry.result);
  }
  assert.ok(seen.size > 30);
  assert.ok([...seen].some(value => characters(value).length === 1));
});

test('repeated-output fallback is bounded, and unavoidable duplicates are reported', () => {
  const a = generateAbbreviation('abcdef', { length: 3, random: () => 0 });
  const b = generateAbbreviation('abcdef', { length: 3, previous: a.result, random: () => 0 });
  assert.notEqual(a.result, b.result);
  assert.equal(b.after, 3);
  const fixed = generateAbbreviation('あああ', { length: 2, previous: 'ああ', random: () => 0 });
  assert.equal(fixed.result, 'ああ');
  assert.equal(fixed.repeated, true);
  assert.notEqual(generateAbbreviation('aaaa', { previous: 'a', random: () => 0 }).result, 'a');
  assert.notEqual(generateAbbreviation('あい', { previous: 'あ', random: () => 0 }).result, 'あ');
});

test('invalid target lengths are rejected', () => {
  for (const length of [0, -1, 4, 5, 1.5, NaN, Infinity, '2']) assert.throws(() => generateAbbreviation('abcd', { length }), RangeError);
});

test('X intent includes correct text and actual page URL, with no private query data', () => {
  const url = new URL(buildShareUrl({ word: '東京&大阪', result: '東阪' }, 'https://example.com/play/?token=private#history'));
  assert.equal(url.origin + url.pathname, 'https://x.com/intent/post');
  assert.equal(url.searchParams.get('text'), '東京&大阪を略した結果……\n\n「東阪」\n\n#勝手に略すな');
  assert.equal(url.searchParams.get('url'), 'https://example.com/play/');
});

test('Discord share text includes the word, result, hashtag and clean current URL', () => {
  assert.equal(buildDiscordText({ word: 'ポケットモンスター', result: 'ポモター' }, 'https://example.com/play/?token=private#result'), 'ポケットモンスターを略した結果……\n\n「ポモター」\n\n#勝手に略すな\nhttps://example.com/play/');
  assert.ok(buildDiscordText({ word: '東京&大阪', result: '東阪' }, 'https://other.example/').includes('東京&大阪を略した結果……'));
});

