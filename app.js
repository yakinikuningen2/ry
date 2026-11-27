import { inspectWord, generateAbbreviation, buildShareUrl, buildDiscordText } from './generator.js';

const $ = id => document.getElementById(id);
const wordInput = $('word');
// Remove the old feature's data without reading or retaining any saved words.
try { window.localStorage.removeItem('katteni-ryakusuna.history.v1'); } catch { /* Storage may be unavailable. */ }
let current = null;
let toastTimer;

function showError(message) {
  $('form-error').textContent = message;
  $('form-error').hidden = !message;
  wordInput.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function updateInput() {
  $('clear-input').hidden = !wordInput.value;
  showError('');
}

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
}

async function copy(text, successMessage = '略語をコピーしました。', failureMessage = 'コピーできませんでした。略語を選択してコピーしてください。') {
  try {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); toast(successMessage); return; }
      catch { /* Continue to local fallback if clipboard permission is denied. */ }
    }
    const focused = document.activeElement;
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.className = 'clipboard-field';
    document.body.append(field);
    field.select();
    field.setSelectionRange(0, text.length);
    let success;
    try { success = document.execCommand('copy'); }
    finally { field.remove(); focused?.focus({ preventScroll: true }); }
    if (!success) throw new Error('copy unavailable');
    toast(successMessage);
  } catch { toast(failureMessage); }
}

function renderResult(entry) {
  $('result-panel').hidden = false;
  $('original-word').textContent = entry.word;
  $('result-word').textContent = entry.result;
  $('result-word').classList.toggle('is-long', entry.after > 9);
  $('result-word').classList.toggle('is-very-long', entry.after > 24);
  $('before-count').textContent = entry.before;
  $('after-count').textContent = entry.after;
  $('reduction-rate').textContent = entry.reduction;
  $('result-actions').hidden = false;
  const showRepeatNotice = entry.before > 1 && entry.repeated;
  $('result-notice').hidden = !showRepeatNotice;
  $('result-notice').textContent = showRepeatNotice ? 'この言葉では別の略語がつくれません。元の言葉を変えてみてください。' : '';
  $('share-x').href = buildShareUrl(entry, location.href);
}

function generate(text) {
  const inspected = inspectWord(text);
  if (inspected.error) { showError(inspected.error); wordInput.focus(); return; }
  showError('');
  const entry = generateAbbreviation(inspected.word, { previous: current?.word === inspected.word ? current.result : '' });
  current = entry;
  renderResult(entry);
}

$('generator-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!event.isComposing && !composing) generate(wordInput.value);
});
let composing = false;
wordInput.addEventListener('compositionstart', () => { composing = true; });
wordInput.addEventListener('compositionend', () => { composing = false; });
wordInput.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault();
});
wordInput.addEventListener('input', updateInput);
$('clear-input').addEventListener('click', () => { wordInput.value = ''; updateInput(); wordInput.focus(); });
$('regenerate').addEventListener('click', () => { if (current) generate(current.word); });
$('copy-result').addEventListener('click', () => { if (current) copy(current.result); });
$('share-discord').addEventListener('click', () => {
  if (current) return copy(buildDiscordText(current, location.href), 'Discord用にコピーしました。貼り付けて送信してください。', '共有文をコピーできませんでした。略語とURLを手動でコピーしてください。');
});
// Absolute metadata for browser previews. Social crawlers read the static tags;
// Vercel's build command sets their production origin before deployment.
if (location.protocol.startsWith('http')) {
  for (const meta of document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]')) meta.content = new URL('./assets/ogp.png', location.href).href;
}
updateInput();
