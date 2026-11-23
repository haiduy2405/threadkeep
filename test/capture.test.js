import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {conversationURL, normalizeCapture, normalizeCaptureBatch, CAPTURE_LIMIT} from '../src/capture.js';
import {parseExport, mergeConversations, validateBackup, toHandoff} from '../src/core.js';
import {vi} from '../src/i18n.js';
const capture = (patch = {}) => ({threadkeep_capture: 1, provider: 'chatgpt', sourceId: 'test-conversation-001', sourceUrl: 'https://chatgpt.com/c/test-conversation-001?tracking=discard', title: 'A synthetic conversation', accountLabel: 'Personal', capturedAt: '2026-11-23T12:00:00Z', messages: [{id: 'm1', role: 'user', text: '<script>text only</script>'}, {id: 'm2', role: 'assistant', text: 'A synthetic answer'}], ...patch});
test('capture URLs require the exact HTTPS provider and saved-chat path', () => {
  assert.equal(conversationURL(capture().sourceUrl).url, 'https://chatgpt.com/c/test-conversation-001');
  assert.equal(conversationURL('https://chatgpt.com/g/g-abc/c/test-conversation-001').sourceId, 'test-conversation-001');
  assert.equal(conversationURL('https://claude.ai/chat/test-conversation-001').provider, 'claude');
  for (const url of ['http://chatgpt.com/c/test-conversation-001', 'https://chatgpt.com.evil.test/c/test-conversation-001', 'javascript:alert(1)', 'https://claude.ai/settings', 'https://username:password@chatgpt.com/c/test-conversation-001']) assert.equal(conversationURL(url), null, url);
});
test('normalization records limited coverage, keeps text inert and separates declared accounts', () => {
  const one = normalizeCapture(capture()), two = normalizeCapture(capture({accountLabel: 'Work'}));
  assert.notEqual(one.id, two.id); assert.match(one.id, /^capture:chatgpt:/); assert.equal(one.updatedAt, null);
  assert.equal(one.captureScope, 'rendered-text'); assert.equal(one.messages[0].text, '<script>text only</script>');
  assert.doesNotMatch(one.sourceUrl, /tracking/); assert.match(one.raw.coverage, /media bytes not included/);
  assert.throws(() => normalizeCapture(capture({sourceId: 'wrong-id'}))); assert.throws(() => normalizeCapture(capture({accountLabel: ''})));
  assert.throws(() => normalizeCapture(capture({messages: [{role: 'alien', text: 'bad'}]})));
});
test('UTF-8 quota and batch validation reject corrupt/duplicate payloads', () => {
  assert.throws(() => normalizeCapture(capture({title: 'あ'.repeat(CAPTURE_LIMIT / 2)})), /2 MB/);
  const batch = {format: 'threadkeep-capture-batch', version: 1, id: 'job-1', captures: [capture()]};
  assert.equal(normalizeCaptureBatch(batch).length, 1);
  assert.throws(() => normalizeCaptureBatch({...batch, captures: [capture(), capture()]}), /Duplicate/);
  assert.throws(() => normalizeCaptureBatch({...batch, version: 2}));
});
test('shorter or older DOM snapshots cannot replace richer captures, and native exports remain separate', () => {
  const chat = normalizeCapture(capture());
  const shorter = normalizeCapture(capture({capturedAt: '2026-11-23T13:00:00Z', messages: [capture().messages[0]]}));
  assert.equal(mergeConversations([chat], [shorter]).skipped, 1);
  const older = normalizeCapture(capture({capturedAt: '2026-11-22T12:00:00Z'})); assert.equal(mergeConversations([chat], [older]).skipped, 1);
  assert.equal(mergeConversations([{...chat, id: 'chatgpt:test-conversation-001', captureScope: undefined}], [chat]).chats.length, 2);
});
test('captured sources round-trip through versioned backups and handoffs retain coverage warnings', () => {
  const chat = {...parseExport([capture()]).chats[0], starred: true, archived: true};
  const restored = validateBackup(JSON.parse(JSON.stringify({format: 'threadkeep', schemaVersion: 1, chats: [chat], projects: []})));
  assert.equal(restored.chats[0].id, chat.id); assert.equal(restored.chats[0].archived, true); assert.equal(restored.chats[0].starred, true);
  assert.match(toHandoff([chat]), /rendered text only/); assert.match(toHandoff([chat], 24000, 'vi'), /nhánh ẩn và file media/);
});
test('extension translations and generated modules stay in sync', () => {
  for (const [source, generated] of [['src/i18n.js', 'extension/i18n.js'], ['src/capture.js', 'extension/capture-normalizer.js']]) assert.equal(readFileSync(new URL('../' + source, import.meta.url), 'utf8'), readFileSync(new URL('../' + generated, import.meta.url), 'utf8'));
  const html = readFileSync(new URL('../extension/capture.html', import.meta.url), 'utf8');
  for (const [, key] of html.matchAll(/data-text="([^"]+)"/g)) assert.ok(Object.hasOwn(vi, key), key);
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url)));
  assert.equal(manifest.manifest_version, 3); assert.deepEqual(manifest.permissions, ['activeTab', 'scripting', 'storage']);
  assert.ok(!JSON.stringify(manifest).includes('<all_urls>')); assert.ok(!JSON.stringify(manifest).includes('cookies'));
});
test('extension service worker gates the pending batch by sender and exact app destination', async () => {
  let handler, removed = false; const pending = {id: 'job-1', captures: [capture()]};
  const chrome = {runtime: {id: 'extension-id', getURL: path => 'chrome-extension://extension-id/' + path, onMessage: {addListener: callback => handler = callback}}, action: {onClicked: {addListener() {}}}, tabs: {create() {}}, storage: {local: {get: async () => ({pendingCapture: pending}), remove: async () => { removed = true; }}}};
  runInNewContext(readFileSync(new URL('../extension/background.js', import.meta.url), 'utf8'), {chrome, URL});
  const call = (message, sender) => new Promise(resolve => { if (handler(message, sender, resolve) !== true) resolve(null); });
  const approved = {id: 'extension-id', tab: {url: 'https://haiduy2405.github.io/threadkeep/'}};
  assert.equal(await call({type: 'THREADKEEP_PULL'}, {...approved, tab: {url: 'https://evil.test/'}}), null);
  assert.equal(await call({type: 'THREADKEEP_PULL'}, {...approved, id: 'another-extension'}), null);
  assert.equal(await call({type: 'THREADKEEP_PULL'}, {...approved, tab: {url: 'https://haiduy2405.github.io/another-project/'}}), null);
  assert.equal((await call({type: 'THREADKEEP_PULL'}, approved)).batch.id, pending.id);
  await call({type: 'THREADKEEP_ACK', id: 'wrong'}, approved); assert.equal(removed, false);
  await call({type: 'THREADKEEP_ACK', id: 'job-1'}, approved); assert.equal(removed, true);
});
