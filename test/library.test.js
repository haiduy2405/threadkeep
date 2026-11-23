import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveLanguage, translator, vi, staticBindings, guideKeys} from '../src/i18n.js';
import {parseExport, filterConversations, mergeConversations, updateConversationState, archiveCandidates, toMarkdown, toHandoff, validateBackup} from '../src/core.js';
const fixture = JSON.parse(readFileSync(new URL('../examples/synthetic-conversations.json', import.meta.url)));
const chats = () => parseExport(fixture).chats;
test('language detection honors explicit choice, regional variants and safe fallback', () => {
  assert.equal(resolveLanguage('en', ['vi-VN']), 'en'); assert.equal(resolveLanguage(null, ['vi-VN', 'en-US']), 'vi');
  assert.equal(resolveLanguage('invalid', ['fr-FR', 'en-GB']), 'en'); assert.equal(resolveLanguage(null, []), 'en');
  assert.equal(translator('vi')('Select {title}', {title: '<script>Giữ nguyên</script>'}), 'Chọn <script>Giữ nguyên</script>');
  assert.equal(translator('en')('Conversations'), 'Conversations');
});
test('all UI bindings and literal translation calls have Vietnamese entries', () => {
  const keys = [...staticBindings.map(b => b[1]), ...guideKeys.flat()];
  for (const file of ['app.js', 'core.js']) {
    const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    keys.push(...[...source.matchAll(/\bt\('((?:\\.|[^'\\])*)'/g)].map(m => m[1].replace(/\\'/g, "'")));
  }
  for (const key of keys) assert.ok(Object.hasOwn(vi, key), `Missing Vietnamese translation: ${key}`);
  for (const [key, value] of Object.entries(vi)) {
    const placeholders = text => [...text.matchAll(/\{\w+\}/g)].map(m => m[0]).sort();
    assert.deepEqual(placeholders(value), placeholders(key), `Mismatched interpolation: ${key}`);
  }
});
test('Vietnamese exports translate structure, preserve original messages and source IDs', () => {
  const [chat] = chats();
  assert.match(toMarkdown([chat], 'vi'), /Công cụ AI: chatgpt/);
  assert.match(toMarkdown([chat], 'vi'), /How should a private AI library work/);
  const handoff = toHandoff([chat], 24000, 'vi');
  assert.match(handoff, /Bản bàn giao dự án/); assert.match(handoff, /KHÔNG phải bản tóm tắt bằng AI/);
  assert.match(handoff, /synthetic-answer/); assert.doesNotMatch(handoff, /moonstone/);
});
test('archive and trash are reversible and isolated from the active library', () => {
  const original = chats(), id = original[0].id;
  const archived = updateConversationState(original, [id], 'archive');
  assert.equal(original[0].archived, undefined); assert.equal(filterConversations(archived).length, 1);
  assert.equal(filterConversations(archived, {status: 'archived'})[0].id, id);
  const trashed = updateConversationState(archived, [id], 'trash');
  assert.equal(filterConversations(trashed, {status: 'archived'}).length, 0); assert.equal(filterConversations(trashed, {status: 'trash'}).length, 1);
  const restored = updateConversationState(trashed, [id], 'restore');
  assert.equal(filterConversations(restored, {status: 'archived'}).length, 1);
  assert.equal(filterConversations(updateConversationState(restored, [id], 'unarchive')).length, 2);
});
test('auto archive excludes stars, trash, archived, demos and missing/invalid dates', () => {
  const base = {id: 'eligible', provider: 'chatgpt', updatedAt: '2026-01-01T00:00:00Z'};
  const list = [base, {...base, id: 'star', starred: true}, {...base, id: 'trash', trashedAt: '2026-01-02'}, {...base, id: 'archived', archived: true}, {...base, id: 'demo', provider: 'demo'}, {...base, id: 'no-date', updatedAt: null}, {...base, id: 'invalid', updatedAt: 'invalid'}, {...base, id: 'recent', updatedAt: '2026-11-23T00:00:00Z'}];
  assert.deepEqual(archiveCandidates(list, 90, Date.parse('2026-11-23')).map(c => c.id), ['eligible']);
  for (const days of [0, -1, 1.5, Infinity, 3651]) assert.throws(() => archiveCandidates(list, days));
});
test('reimport and backup retain archive/trash state; older backups remain compatible', () => {
  const original = chats(), id = original[0].id;
  const organized = updateConversationState(updateConversationState(original, [id], 'archive'), [id], 'trash');
  const reimported = mergeConversations(organized, chats()).chats;
  assert.equal(reimported[0].archived, true); assert.ok(reimported[0].trashedAt);
  const data = {format: 'threadkeep', schemaVersion: 1, chats: reimported, projects: [], settings: {autoArchive: true, archiveDays: 30}};
  const restored = validateBackup(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.chats[0].archived, true); assert.equal(restored.chats[0].trashedAt, reimported[0].trashedAt); assert.equal(restored.settings.archiveDays, 30);
  delete data.settings; assert.equal(validateBackup(data).settings.autoArchive, false);
});
test('message and creation sorting work with missing dates', () => {
  const list = chats(); list[0].createdAt = null;
  assert.equal(filterConversations(list, {sort: 'messages'})[0].provider, 'chatgpt');
  assert.equal(filterConversations(list, {sort: 'created'})[0].provider, 'claude');
});
