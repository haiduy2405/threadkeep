import {SCHEMA_VERSION, parseExport, mergeConversations, filterConversations, activeMessages, allMessages, toMarkdown, toHandoff, validateBackup, archiveCandidates, updateConversationState} from './core.js';
import {readLibrary, saveLibrary} from './storage.js';
import {resolveLanguage, localeFor, translator, errorText, staticBindings, guideKeys} from './i18n.js';
import {normalizeCaptureBatch} from './capture.js';
import {providers} from './providers.js';
let savedLanguage;
try { savedLanguage = localStorage.getItem('threadkeep-language'); } catch { /* Optional preference storage. */ }
let language = resolveLanguage(savedLanguage, navigator.languages || [navigator.language]), t = translator(language), currentReader = null;
let extensionVersion = '', pendingCapture = null;
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let state = {chats: [], projects: [], settings: {autoArchive: false, archiveDays: 90}}, view = {query: '', provider: 'all', sort: 'recent', status: 'active'}, selected = new Set(), busy = false, storageReady = false;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('threadkeep-library') : null;
const label = provider => provider === 'demo' ? t('Demo') : providers.find(p => p.id === provider)?.label || provider;
const formatDate = value => value ? new Date(value).toLocaleDateString(localeFor(language), {month: 'short', day: 'numeric', year: 'numeric'}) : t('Date unknown');
function localizeStatic() {
  document.documentElement.lang = language; document.title = t('Threadkeep — Your AI library'); $('language').value = language;
  for (const [selector, key, attribute] of staticBindings) { const node = document.querySelector(selector); if (node) attribute ? node.setAttribute(attribute, t(key)) : node.textContent = t(key); }
  $('version-label').textContent = `v0.4.1 · ${t('Open source')} · MIT`;
  const headings = $('info').querySelectorAll('h3'), paragraphs = $('info').querySelectorAll(':scope > p');
  guideKeys.forEach(([heading, paragraph], i) => { headings[i].textContent = t(heading); paragraphs[i].textContent = t(paragraph); });
}
let noticeTimer;
function notice(message, error = false) { $('status').textContent = message; $('status').className = error ? 'show error' : 'show'; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('status').className = '', 9000); }
async function mutate(change) {
  if (!storageReady) return notice(t('Storage is unavailable. Reload in a browser with IndexedDB enabled.'), true);
  if (busy) return notice(t('Please wait for the current operation.'));
  busy = true;
  try {
    const commit = async () => { const next = structuredClone(await readLibrary()); next.settings ||= {autoArchive: false, archiveDays: 90}; await change(next); await saveLibrary(next); state = next; channel?.postMessage('changed'); render(); return true; };
    if (!navigator.locks) throw new Error('This browser needs Web Locks support; use a current Chrome, Edge, Firefox or Safari');
    return await navigator.locks.request('threadkeep-write', commit);
  }
  catch (error) { notice(t('Could not save changes: {error}. Your existing library was kept.', {error: errorText(error, t)}), true); return false; }
  finally { busy = false; }
}
function download(name, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function render() {
  const active = state.chats.filter(c => !c.archived && !c.trashedAt);
  $('total').textContent = active.length;
  $('archive-count').textContent = state.chats.filter(c => c.archived && !c.trashedAt).length;
  $('trash-count').textContent = state.chats.filter(c => c.trashedAt).length;
  $('stat-chats').textContent = state.chats.filter(c => !c.trashedAt).length.toLocaleString(localeFor(language));
  $('stat-messages').textContent = state.chats.filter(c => !c.trashedAt).reduce((sum, c) => sum + allMessages(c).length, 0).toLocaleString(localeFor(language));
  $('stat-projects').textContent = state.projects.length;
  $('provider-chips').replaceChildren();
  for (const provider of [{id: 'all', label: t('All AI tools')}, ...providers]) {
    const chip = el('button', `provider-chip ${provider.id} ${view.provider === provider.id ? 'selected' : ''}`);
    chip.setAttribute('aria-pressed', String(view.provider === provider.id));
    const symbol = ({all: '◈', chatgpt: '✳', claude: '✴', gemini: '✦', deepseek: 'D', grok: '𝕏', openwebui: '⌂'})[provider.id];
    chip.append(el('span', 'chip-icon', symbol), el('span', 'chip-name', provider.label), el('span', 'chip-count', state.chats.filter(c => !c.trashedAt && (provider.id === 'all' || c.provider === provider.id)).length));
    chip.onclick = () => { view.provider = provider.id; $('provider').value = provider.id; render(); };
    $('provider-chips').append(chip);
  }
  $('projects').replaceChildren();
  for (const p of state.projects) {
    const b = el('button', `nav ${view.projectId === p.id ? 'active' : ''}`); b.append(el('span', 'project-dot', '●'), el('span', '', p.name), el('b', '', active.filter(c => c.projectId === p.id).length));
    b.onclick = () => navigate('active', false, p.id); $('projects').append(b);
  }
  $('all-nav').classList.toggle('active', view.status === 'active' && !view.projectId && !view.starred);
  $('star-nav').classList.toggle('active', !!view.starred);
  $('archive-nav').classList.toggle('active', view.status === 'archived'); $('trash-nav').classList.toggle('active', view.status === 'trash');
  const name = view.projectId ? state.projects.find(p => p.id === view.projectId)?.name : t(view.status === 'trash' ? 'Trash' : view.status === 'archived' ? 'Archived' : view.starred ? 'Starred' : 'All conversations');
  $('crumb').textContent = name; $('heading').textContent = view.projectId || view.status !== 'active' ? name : t(view.starred ? 'The threads that matter.' : 'Your ideas, kept together.');
  $('assign').replaceChildren(new Option(t('Move to project…'), ''), new Option(t('Unassigned'), '__none__'), ...state.projects.map(p => new Option(p.name, p.id)));
  const chats = filterConversations(state.chats, {...view, locale: localeFor(language)});
  const visible = new Set(chats.map(c => c.id)); selected = new Set([...selected].filter(id => visible.has(id)));
  $('result-count').textContent = t(chats.length === 1 ? '{count} CONVERSATION' : '{count} CONVERSATIONS', {count: chats.length});
  $('selection-count').textContent = selected.size ? t('{count} selected', {count: selected.size}) : t('Select conversations to export a handoff');
  $('bulk').hidden = !selected.size; $('bulk-count').textContent = t('{count} selected', {count: selected.size});
  $('archive-selected').hidden = view.status !== 'active'; $('unarchive-selected').hidden = view.status !== 'archived'; $('trash-selected').hidden = view.status === 'trash'; $('restore-selected').hidden = view.status !== 'trash';
  $('conversations').replaceChildren();
  if (!chats.length) {
    const empty = el('div', 'empty'); empty.append(el('div', 'empty-icon', state.chats.length ? '⌕' : '▤'), el('h2', '', t(state.chats.length ? 'No threads found.' : 'Good ideas deserve a home.')), el('p', '', t(state.chats.length ? 'Try a different search or filter.' : 'Bring your AI conversations together. Everything stays on your device.')));
    if (!state.chats.length) { const b = el('button', 'primary', t('Save from an AI website')); b.onclick = openCaptureSetup; empty.append(b); const demo = el('button', 'quiet', t('Or explore a sample library →')); demo.onclick = loadDemo; empty.append(demo); }
    $('conversations').append(empty);
  }
  for (const c of chats) {
    const row = el('article', 'conversation');
    const check = el('input'); check.type = 'checkbox'; check.checked = selected.has(c.id); check.setAttribute('aria-label', t('Select {title}', {title: c.title})); check.onchange = () => { check.checked ? selected.add(c.id) : selected.delete(c.id); render(); };
    const icon = el('span', `provider-icon ${c.provider}`, ({chatgpt: '✳', claude: '✴', gemini: '✦', deepseek: 'D', grok: '𝕏', openwebui: '⌂'})[c.provider] || '◇');
    const body = el('button', 'conversation-body'); body.append(el('h3', '', c.title));
    const sourceMessages = allMessages(c);
    const q = view.query.toLocaleLowerCase().trim().split(/\s+/)[0];
    const preview = (q && sourceMessages.find(m => m.text.toLocaleLowerCase().includes(q))) || activeMessages(c).find(m => m.role === 'user') || sourceMessages[0];
    const text = preview?.text || t('No text messages'); const pos = q ? Math.max(0, text.toLocaleLowerCase().indexOf(q) - 50) : 0;
    body.append(el('p', '', (pos ? '…' : '') + text.slice(pos, pos + 190)));
    const meta = el('div', 'meta'); meta.append(el('span', `provider-label ${c.provider}`, label(c.provider)), el('span', '', t('{count} messages', {count: sourceMessages.length})));
    if (c.leaves?.length > 1) meta.append(el('span', '', t('{count} branches', {count: c.leaves.length})));
    if (c.projectId) meta.append(el('span', 'project-tag', state.projects.find(p => p.id === c.projectId)?.name || ''));
    if (c.captureScope) meta.append(el('span', 'project-tag', t('Rendered text capture')));
    body.append(meta); body.onclick = () => showReader(c, q ? c.leaves?.find(leaf => activeMessages(c, leaf).some(m => m.text.toLocaleLowerCase().includes(q))) : undefined);
    const end = el('div', 'row-end'); end.append(el('time', '', formatDate(c.updatedAt || c.capturedAt)));
    const star = el('button', `star ${c.starred ? 'on' : ''}`, c.starred ? '★' : '☆'); star.setAttribute('aria-label', t(c.starred ? 'Unstar {title}' : 'Star {title}', {title: c.title})); star.setAttribute('aria-pressed', String(!!c.starred)); star.onclick = () => mutate(next => { const chat = next.chats.find(x => x.id === c.id); if (chat) chat.starred = !chat.starred; }); end.append(star);
    row.append(check, icon, body, end); $('conversations').append(row);
  }
}
function showReader(c, leaf = c.activeLeaf) {
  currentReader = {chat: c, leaf};
  $('reader-title').textContent = c.title; $('reader-provider').textContent = label(c.provider);
  $('reader-meta').replaceChildren(el('p', '', t('Source ID: {id} · {date}', {id: c.sourceId, date: formatDate(c.updatedAt)})));
  if (c.captureScope) $('reader-meta').append(el('p', '', t('Account label: {label}', {label: c.accountLabel})), el('p', '', t('Capture: rendered text only; hidden branches and media files are not included.')));
  const originalURL = c.sourceUrl || (c.provider === 'chatgpt' ? `https://chatgpt.com/c/${encodeURIComponent(c.sourceId)}` : null);
  if (originalURL) { const a = el('a', 'source-link', t('Open original conversation ↗')); a.href = originalURL; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('reader-meta').append(a); }
  $('branch-controls').replaceChildren();
  if (c.leaves?.length > 1) {
    const label = el('label', 'branch-label', t('Conversation branch') + ' '), picker = el('select'); picker.setAttribute('aria-label', t('Conversation branch'));
    c.leaves.forEach((id, i) => picker.add(new Option(t('Branch {count}', {count: i + 1}) + (id === c.activeLeaf ? t(' · active') : ''), id))); picker.value = leaf;
    picker.onchange = () => { currentReader.leaf = picker.value; renderMessages(c, picker.value); }; label.append(picker); $('branch-controls').append(label);
  }
  renderMessages(c, leaf); if (!$('reader').open) $('reader').showModal();
}
function renderMessages(c, leaf) {
  $('messages').replaceChildren();
  for (const m of activeMessages(c, leaf)) {
    const block = el('section', `message ${m.role === 'user' ? 'user' : ''}`); block.append(el('h4', '', t(m.role)), el('pre', '', m.text));
    if (m.attachmentCount) block.append(el('small', '', t('{count} attachment reference(s). Original files are not included.', {count: m.attachmentCount})));
    $('messages').append(block);
  }
}
async function importFiles(files) {
  const incoming = [], warnings = [];
  try {
    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) throw new Error(t('{name} exceeds this alpha\'s 100 MB per-file limit.', {name: file.name}));
      const result = parseExport(JSON.parse(await file.text())); incoming.push(...result.chats); warnings.push(...result.warnings);
    }
    let counts;
    if (await mutate(next => { counts = mergeConversations(next.chats, incoming); next.chats = counts.chats; })) notice(t('Imported: {added} new, {updated} refreshed, {skipped} older copies skipped.', counts) + (warnings.length ? t(' {count} unsupported records skipped.', {count: warnings.length}) : ''));
  } catch (error) { notice(t('Import failed: {error} No files from this batch were saved.', {error: errorText(error, t)}), true); }
}
async function loadDemo() {
  const titles = ['A quieter kind of productivity app', 'The world behind FarBound', 'A visual language for the brand', 'Turning scattered notes into a plan'];
  if (await mutate(next => { next.chats = mergeConversations(next.chats, titles.map((title, i) => ({id: `demo:${i}`, sourceId: `sample-${i}`, title, provider: 'demo', updatedAt: new Date(Date.UTC(2026, 10, 22 - i)).toISOString(), messages: [{id: `demo-${i}-1`, role: 'user', text: ['I want a private workspace that helps me find my best ideas and continue across AI tools.', 'Let’s explore a fantasy world with meaningful exploration and a strong visual identity.', 'Build a calm, readable identity with warm neutrals and a single accent color.', 'Help me organize these notes into goals, decisions, and next steps.'][i]}, {id: `demo-${i}-2`, role: 'assistant', text: 'This is fictional demo content. Try searching, starring a conversation, creating a project, or exporting a handoff. No real account data has been accessed.'}]}))).chats; })) notice(t('Sample library added. Demo conversations are clearly labeled.'));
}
$('import').onclick = openCaptureSetup;
$('advanced-import').onclick = () => $('file-input').click();
$('file-input').onchange = async e => { await importFiles([...e.target.files]); e.target.value = ''; };
$('demo').onclick = loadDemo;
$('all-nav').onclick = () => navigate();
$('star-nav').onclick = () => navigate('active', true);
$('search').oninput = e => { view.query = e.target.value; render(); };
$('provider').onchange = e => { view.provider = e.target.value; render(); };
$('sort').onchange = e => { view.sort = e.target.value; render(); };
$('clear-selection').onclick = () => { selected.clear(); render(); };
$('add-project').onclick = () => { $('project-name').value = ''; $('project-dialog').showModal(); $('project-name').focus(); };
$('cancel-project').onclick = () => $('project-dialog').close();
$('project-form').onsubmit = async e => {
  e.preventDefault(); const name = $('project-name').value.trim(); if (!name) return;
  if (await mutate(next => { if (next.projects.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('A project with this name already exists'); next.projects.push({id: crypto.randomUUID(), name: name.slice(0, 120)}); })) { $('project-dialog').close(); notice(t('Project created. Select conversations to move them into it.')); }
};
$('assign').onchange = async e => { const id = e.target.value; const ids = new Set(selected); if (id) await mutate(next => { next.chats.forEach(c => { if (ids.has(c.id)) c.projectId = id === '__none__' ? null : id; }); }); };
$('export-selected').onclick = () => download('threadkeep-conversations.md', toMarkdown(state.chats.filter(c => selected.has(c.id)), language));
$('handoff').onclick = () => download('threadkeep-handoff.md', toHandoff(state.chats.filter(c => selected.has(c.id)), 24000, language));
$('backup').onclick = () => download(`threadkeep-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({format: 'threadkeep', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...state}, null, 2), 'application/json');
$('restore').onclick = () => $('restore-input').click();
$('restore-input').onchange = async e => {
  try {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 100 * 1024 * 1024) throw new Error(t('Backup exceeds the 100 MB alpha limit.'));
    const restored = validateBackup(JSON.parse(await file.text()));
    if (!confirm(t('Replace this browser library ({current} conversations) with {chats} conversations and {projects} projects? Export a backup first if you want to keep the current library.', {current: state.chats.length, chats: restored.chats.length, projects: restored.projects.length}))) return;
    restored.settings.autoArchive = false;
    if (await mutate(next => { next.chats = restored.chats; next.projects = restored.projects; next.settings = restored.settings; })) { navigate(); notice(t('Library restored.')); }
  } catch (error) { notice(t('Restore failed: {error}', {error: errorText(error, t)}), true); }
  finally { e.target.value = ''; }
};
$('help').onclick = () => $('info').showModal();
$('close-info').onclick = () => $('info').close(); $('close-reader').onclick = () => $('reader').close();
localizeStatic();
try { state = await readLibrary(); state.settings ||= {autoArchive: false, archiveDays: 90}; storageReady = true; render(); await autoArchive(); }
catch (error) { render(); notice(t('Browser storage is unavailable: {error}', {error: errorText(error, t)}), true); }
window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); $('search').focus(); } });
// A second tab must not overwrite a newer library with its stale in-memory copy.
if (channel) {
  channel.onmessage = () => { if (!busy) readLibrary().then(data => { state = data; render(); }).catch(() => {}); };
}
window.addEventListener('focus', () => { if (!busy && storageReady) readLibrary().then(data => { state = data; render(); autoArchive(); }).catch(() => {}); });

function navigate(status = 'active', starred = false, projectId) { Object.assign(view, {status, starred, projectId}); selected.clear(); render(); }
$('language').onchange = e => {
  language = resolveLanguage(e.target.value); t = translator(language); let persisted = true;
  try { localStorage.setItem('threadkeep-language', language); } catch { persisted = false; }
  localizeStatic(); render(); if ($('reader').open && currentReader) showReader(currentReader.chat, currentReader.leaf);
  updateExtensionState(); if (pendingCapture) renderCapturePreview();
  if ($('archive-dialog').open && archivePreview) previewArchive();
  notice(t(persisted ? 'Language changed. Your conversations stay in their original language.' : 'Language changed for this tab. Browser settings prevented saving your preference.'));
};
$('archive-nav').onclick = () => navigate('archived'); $('trash-nav').onclick = () => navigate('trash');
async function changeSelected(action) {
  const ids = [...selected]; if (!ids.length) return;
  if (await mutate(next => { next.chats = updateConversationState(next.chats, ids, action); })) notice(t('Conversations updated.'));
}
$('archive-selected').onclick = () => changeSelected('archive'); $('unarchive-selected').onclick = () => changeSelected('unarchive'); $('trash-selected').onclick = () => changeSelected('trash'); $('restore-selected').onclick = () => changeSelected('restore');
let archivePreview = null;
function resetArchivePreview() { archivePreview = null; $('archive-apply').disabled = true; $('archive-preview-result').textContent = ''; }
function previewArchive() {
  try {
    const days = Number($('archive-days').value), candidates = archiveCandidates(state.chats, days);
    archivePreview = {days, ids: candidates.map(c => c.id), enabled: $('archive-auto').checked};
    $('archive-preview-result').textContent = t('Preview: {count} conversations will be archived. Starred conversations and trash are excluded.', {count: candidates.length}); $('archive-apply').disabled = false;
  } catch (error) { resetArchivePreview(); notice(errorText(error, t), true); }
}
async function autoArchive() {
  if (!storageReady || busy || !state.settings?.autoArchive || !archiveCandidates(state.chats, state.settings.archiveDays).length) return;
  let archived = 0;
  if (await mutate(next => {
    if (!next.settings.autoArchive) return;
    const candidates = archiveCandidates(next.chats, next.settings.archiveDays); archived = candidates.length;
    next.chats = updateConversationState(next.chats, candidates.map(c => c.id), 'archive');
  })) { if (archived) notice(t('Automatically archived {count} conversations.', {count: archived})); }
}
$('archive-settings').onclick = () => { $('archive-days').value = state.settings?.archiveDays || 90; $('archive-auto').checked = !!state.settings?.autoArchive; resetArchivePreview(); $('archive-dialog').showModal(); };
$('archive-days').oninput = resetArchivePreview; $('archive-auto').onchange = resetArchivePreview; $('archive-preview').onclick = previewArchive; $('archive-cancel').onclick = () => $('archive-dialog').close();
$('archive-apply').onclick = async () => {
  if (!archivePreview) return;
  const preview = archivePreview; let archived = 0;
  if (await mutate(next => {
    const eligible = new Set(archiveCandidates(next.chats, preview.days).map(c => c.id));
    const ids = preview.ids.filter(id => eligible.has(id)); archived = ids.length;
    next.settings = {autoArchive: preview.enabled, archiveDays: preview.days}; next.chats = updateConversationState(next.chats, ids, 'archive');
  })) { $('archive-dialog').close(); resetArchivePreview(); notice(t('Archive settings saved. {count} conversations archived.', {count: archived})); }
};
setInterval(autoArchive, 60000);

function bridge(message) { window.postMessage({channel: 'threadkeep-app', ...message}, location.origin); }
function updateExtensionState() { $('extension-state').textContent = extensionVersion ? t('Extension connected: {version}', {version: extensionVersion}) : t('The extension is not detected in this tab. After installing it, reload this page.'); }
function openCaptureSetup() {
  if (pendingCapture) { renderCapturePreview(); if (!$('capture-review').open) $('capture-review').showModal(); }
  else { updateExtensionState(); $('connect-dialog').showModal(); bridge({type: 'READY'}); }
}
function renderCapturePreview() {
  if (!pendingCapture) return;
  $('capture-summary').textContent = t('Review {count} captured conversations before adding them to this browser library.', {count: pendingCapture.chats.length});
  $('capture-titles').replaceChildren(...pendingCapture.chats.map(c => el('li', '', `${c.title} · ${label(c.provider)} · ${c.accountLabel} · ${c.messages.length}`)));
}
$('close-connect').onclick = () => $('connect-dialog').close();
$('capture-later').onclick = () => $('capture-review').close();
$('capture-confirm').onclick = async () => {
  if (!pendingCapture) return;
  const capture = pendingCapture; let counts;
  $('capture-confirm').disabled = true;
  try {
    const saved = await mutate(next => {
      if (next.captureReceipts?.includes(capture.id)) { counts = {added: 0, updated: 0, skipped: capture.chats.length}; return; }
      counts = mergeConversations(next.chats, capture.chats); next.chats = counts.chats;
      next.captureReceipts = [...(next.captureReceipts || []), capture.id].slice(-200);
    });
    if (saved) {
      bridge({type: 'ACK', id: capture.id}); pendingCapture = null; $('capture-review').close();
      notice(t('Captured: {count} new, {updated} refreshed, {skipped} older or shorter copies skipped.', {count: counts.added, updated: counts.updated, skipped: counts.skipped}));
    }
  } finally { $('capture-confirm').disabled = false; }
};
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'threadkeep-extension') return;
  if (event.data.type === 'CONNECTED' && typeof event.data.version === 'string' && /^\d+\.\d+\.\d+$/.test(event.data.version)) { extensionVersion = event.data.version; updateExtensionState(); }
  if (event.data.type !== 'CAPTURE_BATCH' || !storageReady) return;
  try {
    const batch = event.data.batch, chats = normalizeCaptureBatch(batch);
    if (state.captureReceipts?.includes(batch.id)) { bridge({type: 'ACK', id: batch.id}); notice(t('Capture was already saved.')); return; }
    if (pendingCapture?.id === batch.id) return;
    pendingCapture = {id: batch.id, chats}; renderCapturePreview();
    if ($('connect-dialog').open) $('connect-dialog').close();
    if (!document.querySelector('dialog[open]')) $('capture-review').showModal();
  } catch (error) { notice(errorText(error, t), true); }
});
updateExtensionState(); bridge({type: 'READY'});
