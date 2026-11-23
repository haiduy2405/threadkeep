import {SCHEMA_VERSION, parseExport, mergeConversations, filterConversations, activeMessages, allMessages, toMarkdown, toHandoff, validateBackup} from './core.js';
import {readLibrary, saveLibrary} from './storage.js';
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
let state = {chats: [], projects: []}, view = {query: '', provider: 'all', sort: 'recent'}, selected = new Set(), busy = false, storageReady = false;
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('threadkeep-library') : null;
const label = provider => ({chatgpt: 'ChatGPT', claude: 'Claude', demo: 'Demo'}[provider] || provider);
const formatDate = value => value ? new Date(value).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : 'Date unknown';
let noticeTimer;
function notice(message, error = false) { $('status').textContent = message; $('status').className = error ? 'show error' : 'show'; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('status').className = '', 9000); }
async function mutate(change) {
  if (!storageReady) return notice('Storage is unavailable. Reload in a browser with IndexedDB enabled.', true);
  if (busy) return notice('Please wait for the current operation.');
  busy = true;
  try {
    const commit = async () => { const next = structuredClone(await readLibrary()); await change(next); await saveLibrary(next); state = next; channel?.postMessage('changed'); render(); return true; };
    if (!navigator.locks) throw new Error('This browser needs Web Locks support; use a current Chrome, Edge, Firefox or Safari');
    return await navigator.locks.request('threadkeep-write', commit);
  }
  catch (error) { notice(`Could not save changes: ${error.message}. Your existing library was kept.`, true); return false; }
  finally { busy = false; }
}
function download(name, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function render() {
  $('total').textContent = state.chats.length;
  $('stat-chats').textContent = state.chats.length.toLocaleString();
  $('stat-messages').textContent = state.chats.reduce((sum, c) => sum + allMessages(c).length, 0).toLocaleString();
  $('stat-projects').textContent = state.projects.length;
  $('projects').replaceChildren();
  for (const p of state.projects) {
    const b = el('button', `nav ${view.projectId === p.id ? 'active' : ''}`); b.append(el('span', 'project-dot', '●'), el('span', '', p.name), el('b', '', state.chats.filter(c => c.projectId === p.id).length));
    b.onclick = () => { view.projectId = p.id; view.starred = false; selected.clear(); render(); }; $('projects').append(b);
  }
  $('all-nav').classList.toggle('active', !view.projectId && !view.starred);
  $('star-nav').classList.toggle('active', !!view.starred);
  const name = view.projectId ? state.projects.find(p => p.id === view.projectId)?.name : view.starred ? 'Starred' : 'All conversations';
  $('crumb').textContent = name; $('heading').textContent = view.projectId ? name : view.starred ? 'The threads that matter.' : 'Your ideas, kept together.';
  $('assign').replaceChildren(new Option('Move to project…', ''), new Option('Unassigned', '__none__'), ...state.projects.map(p => new Option(p.name, p.id)));
  const chats = filterConversations(state.chats, view);
  const visible = new Set(chats.map(c => c.id)); selected = new Set([...selected].filter(id => visible.has(id)));
  $('result-count').textContent = `${chats.length} CONVERSATION${chats.length === 1 ? '' : 'S'}`;
  $('selection-count').textContent = selected.size ? `${selected.size} selected` : 'Select conversations to export a handoff';
  $('bulk').hidden = !selected.size; $('bulk-count').textContent = `${selected.size} selected`;
  $('conversations').replaceChildren();
  if (!chats.length) {
    const empty = el('div', 'empty'); empty.append(el('div', 'empty-icon', state.chats.length ? '⌕' : '▤'), el('h2', '', state.chats.length ? 'No threads found.' : 'Good ideas deserve a home.'), el('p', '', state.chats.length ? 'Try a different search or filter.' : 'Bring your ChatGPT and Claude conversations together. Everything stays on your device.'));
    if (!state.chats.length) { const b = el('button', 'primary', 'Import your first conversations'); b.onclick = () => $('file-input').click(); empty.append(b); const demo = el('button', 'quiet', 'Or explore a sample library →'); demo.onclick = loadDemo; empty.append(demo); }
    $('conversations').append(empty);
  }
  for (const c of chats) {
    const row = el('article', 'conversation');
    const check = el('input'); check.type = 'checkbox'; check.checked = selected.has(c.id); check.setAttribute('aria-label', `Select ${c.title}`); check.onchange = () => { check.checked ? selected.add(c.id) : selected.delete(c.id); render(); };
    const icon = el('span', `provider-icon ${c.provider}`, c.provider === 'chatgpt' ? '✳' : c.provider === 'claude' ? '✴' : '◇');
    const body = el('button', 'conversation-body'); body.append(el('h3', '', c.title));
    const sourceMessages = allMessages(c);
    const q = view.query.toLocaleLowerCase().trim().split(/\s+/)[0];
    const preview = (q && sourceMessages.find(m => m.text.toLocaleLowerCase().includes(q))) || activeMessages(c).find(m => m.role === 'user') || sourceMessages[0];
    const text = preview?.text || 'No text messages'; const pos = q ? Math.max(0, text.toLocaleLowerCase().indexOf(q) - 50) : 0;
    body.append(el('p', '', (pos ? '…' : '') + text.slice(pos, pos + 190)));
    const meta = el('div', 'meta'); meta.append(el('span', `provider-label ${c.provider}`, label(c.provider)), el('span', '', `${sourceMessages.length} messages`));
    if (c.leaves?.length > 1) meta.append(el('span', '', `${c.leaves.length} branches`));
    if (c.projectId) meta.append(el('span', 'project-tag', state.projects.find(p => p.id === c.projectId)?.name || ''));
    body.append(meta); body.onclick = () => showReader(c, q ? c.leaves?.find(leaf => activeMessages(c, leaf).some(m => m.text.toLocaleLowerCase().includes(q))) : undefined);
    const end = el('div', 'row-end'); end.append(el('time', '', formatDate(c.updatedAt)));
    const star = el('button', `star ${c.starred ? 'on' : ''}`, c.starred ? '★' : '☆'); star.setAttribute('aria-label', `${c.starred ? 'Unstar' : 'Star'} ${c.title}`); star.setAttribute('aria-pressed', String(!!c.starred)); star.onclick = () => mutate(next => { const chat = next.chats.find(x => x.id === c.id); chat.starred = !chat.starred; }); end.append(star);
    row.append(check, icon, body, end); $('conversations').append(row);
  }
}
function showReader(c, leaf) {
  $('reader-title').textContent = c.title; $('reader-provider').textContent = label(c.provider);
  $('reader-meta').replaceChildren(el('p', '', `Source ID: ${c.sourceId} · ${formatDate(c.updatedAt)}`));
  if (c.provider === 'chatgpt') { const a = el('a', 'source-link', 'Open original conversation ↗'); a.href = `https://chatgpt.com/c/${encodeURIComponent(c.sourceId)}`; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('reader-meta').append(a); }
  $('branch-controls').replaceChildren();
  if (c.leaves?.length > 1) {
    const label = el('label', 'branch-label', 'Conversation branch '), picker = el('select');
    c.leaves.forEach((id, i) => picker.add(new Option(`Branch ${i + 1}${id === c.activeLeaf ? ' · active' : ''}`, id))); picker.value = leaf || c.activeLeaf;
    picker.onchange = () => renderMessages(c, picker.value); label.append(picker); $('branch-controls').append(label);
  }
  renderMessages(c, leaf); if (!$('reader').open) $('reader').showModal();
}
function renderMessages(c, leaf) {
  $('messages').replaceChildren();
  for (const m of activeMessages(c, leaf)) {
    const block = el('section', `message ${m.role === 'user' ? 'user' : ''}`); block.append(el('h4', '', m.role), el('pre', '', m.text));
    if (m.attachmentCount) block.append(el('small', '', `${m.attachmentCount} attachment reference(s). Original files are not included.`));
    $('messages').append(block);
  }
}
async function importFiles(files) {
  const incoming = [], warnings = [];
  try {
    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name} exceeds this alpha's 100 MB per-file limit.`);
      const result = parseExport(JSON.parse(await file.text())); incoming.push(...result.chats); warnings.push(...result.warnings);
    }
    let counts;
    if (await mutate(next => { counts = mergeConversations(next.chats, incoming); next.chats = counts.chats; })) notice(`Imported: ${counts.added} new, ${counts.updated} refreshed, ${counts.skipped} older copies skipped.${warnings.length ? ` ${warnings.length} unsupported records skipped.` : ''}`);
  } catch (error) { notice(`Import failed: ${error.message} No files from this batch were saved.`, true); }
}
async function loadDemo() {
  const titles = ['A quieter kind of productivity app', 'The world behind FarBound', 'A visual language for the brand', 'Turning scattered notes into a plan'];
  if (await mutate(next => { next.chats = mergeConversations(next.chats, titles.map((title, i) => ({id: `demo:${i}`, sourceId: `sample-${i}`, title, provider: 'demo', updatedAt: new Date(Date.UTC(2026, 10, 22 - i)).toISOString(), messages: [{id: `demo-${i}-1`, role: 'user', text: ['I want a private workspace that helps me find my best ideas and continue across AI tools.', 'Let’s explore a fantasy world with meaningful exploration and a strong visual identity.', 'Build a calm, readable identity with warm neutrals and a single accent color.', 'Help me organize these notes into goals, decisions, and next steps.'][i]}, {id: `demo-${i}-2`, role: 'assistant', text: 'This is fictional demo content. Try searching, starring a conversation, creating a project, or exporting a handoff. No real account data has been accessed.'}]}))).chats; })) notice('Sample library added. Demo conversations are clearly labeled.');
}
$('import').onclick = () => $('file-input').click();
$('file-input').onchange = async e => { await importFiles([...e.target.files]); e.target.value = ''; };
$('demo').onclick = loadDemo;
$('all-nav').onclick = () => { view.projectId = undefined; view.starred = false; selected.clear(); render(); };
$('star-nav').onclick = () => { view.projectId = undefined; view.starred = true; selected.clear(); render(); };
$('search').oninput = e => { view.query = e.target.value; render(); };
$('provider').onchange = e => { view.provider = e.target.value; render(); };
$('sort').onchange = e => { view.sort = e.target.value; render(); };
$('clear-selection').onclick = () => { selected.clear(); render(); };
$('add-project').onclick = () => { $('project-name').value = ''; $('project-dialog').showModal(); $('project-name').focus(); };
$('cancel-project').onclick = () => $('project-dialog').close();
$('project-form').onsubmit = async e => {
  e.preventDefault(); const name = $('project-name').value.trim(); if (!name) return;
  if (await mutate(next => { if (next.projects.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('A project with this name already exists'); next.projects.push({id: crypto.randomUUID(), name: name.slice(0, 120)}); })) { $('project-dialog').close(); notice('Project created. Select conversations to move them into it.'); }
};
$('assign').onchange = async e => { const id = e.target.value; if (id) await mutate(next => { next.chats.forEach(c => { if (selected.has(c.id)) c.projectId = id === '__none__' ? null : id; }); }); };
$('export-selected').onclick = () => download('threadkeep-conversations.md', toMarkdown(state.chats.filter(c => selected.has(c.id))));
$('handoff').onclick = () => download('threadkeep-handoff.md', toHandoff(state.chats.filter(c => selected.has(c.id))));
$('backup').onclick = () => download(`threadkeep-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({format: 'threadkeep', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), ...state}, null, 2), 'application/json');
$('restore').onclick = () => $('restore-input').click();
$('restore-input').onchange = async e => {
  try {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 100 * 1024 * 1024) throw new Error('Backup exceeds the 100 MB alpha limit.');
    const restored = validateBackup(JSON.parse(await file.text()));
    if (!confirm(`Replace this browser library (${state.chats.length} conversations) with ${restored.chats.length} conversations and ${restored.projects.length} projects? Export a backup first if you want to keep the current library.`)) return;
    if (await mutate(next => { next.chats = restored.chats; next.projects = restored.projects; })) { selected.clear(); view.projectId = undefined; render(); notice('Library restored.'); }
  } catch (error) { notice(`Restore failed: ${error.message}`, true); }
  finally { e.target.value = ''; }
};
$('help').onclick = () => $('info').showModal();
$('close-info').onclick = () => $('info').close(); $('close-reader').onclick = () => $('reader').close();
try { state = await readLibrary(); storageReady = true; render(); }
catch (error) { render(); notice(`Browser storage is unavailable: ${error.message}`, true); }
window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); $('search').focus(); } });
// A second tab must not overwrite a newer library with its stale in-memory copy.
if (channel) {
  channel.onmessage = () => { if (!busy) readLibrary().then(data => { state = data; render(); }).catch(() => {}); };
}
window.addEventListener('focus', () => { if (!busy && storageReady) readLibrary().then(data => { state = data; render(); }).catch(() => {}); });
