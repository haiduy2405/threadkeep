import {translator, resolveLanguage, errorText} from './i18n.js';
import {conversationURL, normalizeCapture, normalizeCaptureBatch, BATCH_LIMIT} from './capture-normalizer.js';
const $ = id => document.getElementById(id), params = new URL(location.href).searchParams;
const appURL = 'https://haiduy2405.github.io/threadkeep/';
let sourceTab, providerOrigin, entries = [], selected = new Set(), running = false, cancelled = false;
const preferences = await chrome.storage.local.get(['language', 'accountLabels', 'pendingCapture']);
let language = resolveLanguage(preferences.language, navigator.languages), t = translator(language);
function localize() {
  document.documentElement.lang = language; $('language').value = language;
  document.querySelectorAll('[data-text]').forEach(node => node.textContent = t(node.dataset.text));
  $('search').placeholder = t('Search titles and messages…'); $('search').setAttribute('aria-label', t('Filter discovered conversations'));
  $('account').placeholder = t('Personal / Work'); render();
}
function status(key, values = {}) { $('status').textContent = t(key, values); }
function lock(value) { running = value; $('save-one').disabled = value || !providerOrigin; $('scan').disabled = value || !providerOrigin; $('save-selected').disabled = value || !selected.size; $('account').disabled = value; $('cancel').hidden = !value; }
async function read(tabId, mode) {
  await chrome.scripting.executeScript({target: {tabId}, files: ['dom-reader.js']});
  const [result] = await chrome.scripting.executeScript({target: {tabId}, func: mode => threadkeepRead(mode), args: [mode]});
  if (!result?.result) throw new Error('The reader did not return any data.'); return result.result;
}
function accountLabel() { const value = $('account').value.trim(); if (!value || value.length > 64) throw new Error('Enter an account label (1–64 characters).'); return value; }
async function checkPending() {
  const {pendingCapture} = await chrome.storage.local.get('pendingCapture');
  $('pending').hidden = !pendingCapture;
  if (pendingCapture) throw new Error('Finish reviewing the pending capture in Threadkeep before saving another batch.');
}
async function transfer(captures) {
  const batch = {format: 'threadkeep-capture-batch', version: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), captures}; normalizeCaptureBatch(batch);
  await navigator.locks.request('threadkeep-capture-pending', async () => {
    await checkPending();
    const {accountLabels = {}} = await chrome.storage.local.get('accountLabels'); accountLabels[providerOrigin] = accountLabel();
    await chrome.storage.local.set({pendingCapture: batch, accountLabels});
  });
  $('pending').hidden = false; await chrome.tabs.create({url: appURL});
  status('Sent {count} conversations to Threadkeep. Review and confirm there to save them.', {count: captures.length});
}
function render() {
  $('items').replaceChildren(); const query = $('search').value.toLocaleLowerCase();
  for (const item of entries.filter(item => item.title.toLocaleLowerCase().includes(query))) {
    const row = document.createElement('label'); row.className = 'item'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(item.url);
    check.disabled = running; check.onchange = () => { check.checked ? selected.add(item.url) : selected.delete(item.url); render(); };
    const title = document.createElement('span'); title.textContent = item.title; row.append(check, title); $('items').append(row);
  }
  $('coverage').textContent = t('Found {count} conversations in the loaded history. This does not prove the whole account was loaded.', {count: entries.length});
  $('select-all').checked = entries.length > 0 && selected.size === entries.length; $('select-all').indeterminate = selected.size > 0 && selected.size < entries.length; $('select-all').disabled = running;
  $('save-selected').disabled = running || !selected.size;
}
$('language').onchange = async e => { language = resolveLanguage(e.target.value); t = translator(language); await chrome.storage.local.set({language}); localize(); };
$('search').oninput = render; $('select-all').onchange = e => { selected = new Set(e.target.checked ? entries.map(item => item.url) : []); render(); };
$('pending').onclick = () => chrome.tabs.create({url: appURL}); $('cancel').onclick = () => { cancelled = true; status('Stopping after the current conversation…'); };
$('save-one').onclick = async () => {
  lock(true);
  try { await checkPending(); const label = accountLabel(); status('Reading the current conversation…'); const capture = await read(sourceTab.id, 'read'); capture.accountLabel = label; normalizeCapture(capture); await transfer([capture]); }
  catch (error) { status(errorText(error, t)); } finally { lock(false); }
};
$('scan').onclick = async () => {
  try {
    accountLabel();
    const granted = await chrome.permissions.request({origins: [providerOrigin + '/*']});
    if (!granted) throw new Error('Site permission was not granted. You can still save the current conversation.');
    lock(true); status('Finding conversation links in the loaded history…');
    const result = await read(sourceTab.id, 'discover'), unique = new Map();
    for (const item of result.items) { const source = conversationURL(item.url); if (source && new URL(source.url).origin === providerOrigin) unique.set(source.sourceId, item); }
    entries = [...unique.values()]; selected.clear(); $('history').hidden = false; render();
    status(entries.length ? 'Choose conversations, or select all discovered, then save.' : 'No conversation links were found. Open the history/sidebar on the AI site and try again.');
  } catch (error) { status(errorText(error, t)); } finally { lock(false); }
};
async function waitForTab(tabId) {
  for (let i = 0; i < 80; i++) { if (cancelled) return; const tab = await chrome.tabs.get(tabId); if (tab.status === 'complete') return; await new Promise(resolve => setTimeout(resolve, 250)); }
  throw new Error('The conversation page did not finish loading.');
}
$('save-selected').onclick = async () => {
  const targets = entries.filter(item => selected.has(item.url)), captures = []; let helper;
  if (!targets.length) return;
  try {
    await checkPending(); const label = accountLabel();
    if (targets.length > 100) throw new Error('Choose at most 100 conversations per batch.');
    lock(true); cancelled = false; $('errors').replaceChildren();
    const granted = await chrome.permissions.contains({origins: [providerOrigin + '/*']}); if (!granted) throw new Error('Site permission is required to read other conversations.');
    for (let index = 0; index < targets.length && !cancelled; index++) {
      const item = targets[index]; status('Reading {current}/{total}: {title}', {current: index + 1, total: targets.length, title: item.title});
      try {
        const source = conversationURL(item.url); if (!source || new URL(source.url).origin !== providerOrigin) throw new Error('Invalid capture source.');
        if (!helper) helper = await chrome.tabs.create({url: source.url, active: false}); else await chrome.tabs.update(helper.id, {url: source.url});
        await waitForTab(helper.id); if (cancelled) break;
        const capture = await read(helper.id, 'read');
        if (capture.sourceId !== source.sourceId || capture.provider !== source.provider) throw new Error('The loaded conversation does not match the selection.');
        capture.accountLabel = label; normalizeCapture(capture);
        if (new TextEncoder().encode(JSON.stringify(captures) + JSON.stringify(capture)).length > BATCH_LIMIT - 4096) throw new Error('Capture batch exceeds the 8 MB limit.');
        captures.push(capture);
      } catch (error) { const row = document.createElement('li'); row.textContent = item.title + ': ' + errorText(error, t); $('errors').append(row); }
    }
    if (captures.length) await transfer(captures); else status('No conversations were saved. Review the errors and retry.');
  } catch (error) { status(errorText(error, t)); }
  finally { if (helper) await chrome.tabs.remove(helper.id).catch(() => {}); lock(false); render(); }
};
localize();
try {
  sourceTab = await chrome.tabs.get(Number(params.get('tab')));
  const url = new URL(sourceTab.url); if (!['https://chatgpt.com', 'https://claude.ai'].includes(url.origin)) throw new Error('Open ChatGPT or Claude, then click the Threadkeep extension icon.');
  providerOrigin = url.origin; $('source').textContent = `${url.hostname} · ${sourceTab.title || ''}`; $('account').value = preferences.accountLabels?.[providerOrigin] || '';
  if (preferences.pendingCapture) { $('pending').hidden = false; status('Finish reviewing the pending capture in Threadkeep before saving another batch.'); }
} catch (error) { status(errorText(error, t)); }
lock(false);
