// All generation happens locally. A character means a Unicode grapheme cluster.
const segmenter = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;

export function characters(text) {
  if (segmenter) return Array.from(segmenter.segment(text), item => item.segment);
  // Fallback for older browsers: preserve combining marks, emoji modifiers,
  // variation selectors, ZWJ sequences and paired regional indicators.
  const result = [];
  let regionalCount = 0;
  for (const point of Array.from(text)) {
    const regional = /\p{Regional_Indicator}/u.test(point);
    const previous = result.at(-1);
    if (previous && (/^[\p{Mark}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D]$/u.test(point) || previous.endsWith('\u200D') || (regional && regionalCount % 2 === 1))) {
      result[result.length - 1] += point;
    } else result.push(point);
    regionalCount = regional ? regionalCount + 1 : 0;
  }
  return result;
}

export function cleanWord(text) {
  return String(text).replace(/[\s\u200B]+/gu, '');
}

export function inspectWord(text) {
  const word = cleanWord(text);
  const chars = characters(word);
  let error = '';
  if (!word) error = '略したい言葉を入力してください。';
  return { word, chars, error };
}

const randomInt = (max, random) => Math.min(max - 1, Math.floor(random() * max));
const attachedKana = /^[ゃゅょぁぃぅぇぉゎゕゖャュョァィゥェォヮヵヶー]/u;

// Mix independent character picks with short contiguous runs. Small kana and
// long vowels preferentially follow their original preceding character.
function pickIndices(chars, length, random) {
  const selected = [];
  const blocks = random() < 0.55;
  let index = 0;
  // Walk forward once, increasing the selection probability as fewer source
  // characters remain. This keeps exact lengths without sorting every pick.
  while (selected.length < length) {
    const remaining = length - selected.length;
    const available = chars.length - index;
    if (remaining === available) {
      while (index < chars.length) selected.push(index++);
      break;
    }
    if (random() >= remaining / available) { index++; continue; }
    const run = blocks ? 1 + randomInt(Math.min(3, remaining, available), random) : 1;
    for (let i = 0; i < run; i++) selected.push(index++);
    if (selected.length < length && attachedKana.test(chars[index] || '') && random() < 0.8) selected.push(index++);
  }
  return selected;
}

// Extreme subsequences provide a bounded deterministic fallback after random
// retries. If both extremes equal the previous value, no other value exists.
function extremeSubsequence(chars, length, largest) {
  const chosen = [];
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];
    while (chosen.length && chosen.length - 1 + chars.length - index >= length && (largest ? chosen.at(-1) < char : chosen.at(-1) > char)) {
      chosen.pop();
    }
    if (chosen.length < length) chosen.push(char);
  }
  return chosen.join('');
}

function* fallbackCandidates(chars, size) {
  const smallest = extremeSubsequence(chars, size, false);
  yield smallest;
  const largest = extremeSubsequence(chars, size, true);
  yield largest;
  if (smallest === largest && characters(smallest).length === size) return;
  // Joining separated graphemes can change their boundaries (e.g. flags).
  // Test contiguous windows lazily instead of storing all of them in memory.
  for (let start = 0; start <= chars.length - size; start++) yield chars.slice(start, start + size).join('');
}

export function generateAbbreviation(text, { length = null, previous = '', random = Math.random } = {}) {
  const { word, chars, error } = inspectWord(text);
  if (error) throw new RangeError(error);
  const limit = Math.max(1, chars.length - 1);
  if (length !== null && (!Number.isInteger(length) || length < 1 || length > limit)) {
    throw new RangeError(`仕上がりは1〜${limit}文字で指定してください。`);
  }
  if (chars.length === 1) {
    return { word, result: word, before: 1, after: 1, reduction: 0, repeated: word === previous };
  }
  // Short words keep punchy results. Longer words get a proportional range
  // instead of being forced into the same six-character ceiling.
  const maximum = chars.length <= 12 ? Math.min(chars.length - 1, 6) : Math.min(chars.length - 1, Math.max(6, Math.round(chars.length * 0.55)));
  const minimum = chars.length <= 12 ? 1 : Math.max(2, Math.round(chars.length * 0.12));
  let result = '';
  let target = length;
  let valid = false;
  for (let attempt = 0; attempt < 32; attempt++) {
    target = length ?? minimum + randomInt(maximum - minimum + 1, random);
    const indices = pickIndices(chars, target, random);
    result = indices.map(index => chars[index]).join('');
    valid = characters(result).length === target;
    if (valid && result !== previous) break;
  }
  if (!valid || result === previous) {
    // Try every automatic length as well, so "aaaa" can become "aa" or "a".
    for (let size = length ?? minimum; size <= (length ?? maximum); size++) {
      let foundAlternative = false;
      for (const candidate of fallbackCandidates(chars, size)) {
        if (characters(candidate).length !== size) continue;
        if (!valid || candidate !== previous) { result = candidate; valid = true; }
        if (candidate !== previous) { foundAlternative = true; break; }
      }
      if (foundAlternative) break;
    }
  }
  const after = characters(result).length;
  return { word, result, before: chars.length, after, reduction: Math.round((chars.length - after) / chars.length * 100), repeated: result === previous };
}

function publicPageUrl(pageUrl) {
  const page = new URL(pageUrl);
  // Never include unrelated query parameters or fragments in a public post.
  page.search = '';
  page.hash = '';
  return page.href;
}

function shareText(entry) {
  return `${entry.word}を略した結果……\n\n「${entry.result}」\n\n#勝手に略すな`;
}

export function buildDiscordText(entry, pageUrl) {
  return `${shareText(entry)}\n${publicPageUrl(pageUrl)}`;
}

export function buildShareUrl(entry, pageUrl) {
  const intent = new URL('https://x.com/intent/post');
  intent.searchParams.set('text', shareText(entry));
  intent.searchParams.set('url', publicPageUrl(pageUrl));
  return intent.href;
}
