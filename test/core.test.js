import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseExport, activeMessages, mergeConversations, filterConversations, toMarkdown, toHandoff, validateBackup} from '../src/core.js';
const message = (id, text, role = 'user') => ({id, author: {role}, content: {parts: [text]}, create_time: 1700000000});
const gpt = () => ({id: 'g1', title: 'Game world', create_time: 1700000000, update_time: 1700000010, current_node: 'b', mapping: {root: {parent: null, children: ['a']}, a: {parent: 'root', children: ['b', 'c'], message: message('m1', 'A fantasy game')}, b: {parent: 'a', children: [], message: message('m2', 'Active idea', 'assistant')}, c: {parent: 'a', children: [], message: message('m3', 'Rejected secret alternative', 'assistant')}}});
const claude = () => ({uuid: 'c1', name: 'Design', created_at: '2026-01-02T12:00:00Z', updated_at: '2026-01-02T13:00:00Z', chat_messages: [{uuid: 'c-m1', sender: 'human', text: '', content: [{type: 'text', text: 'Vietnamese: tiếng Việt'}, {type: 'image'}], attachments: [{file_name: 'art.png'}]}]});
test('ChatGPT active branch excludes rejected sibling; siblings remain searchable', () => {
  const c = parseExport([gpt()]).chats[0];
  assert.deepEqual(activeMessages(c).map(m => m.id), ['m1', 'm2']);
  assert.deepEqual(activeMessages(c, 'c').map(m => m.id), ['m1', 'm3']);
  assert.equal(c.leaves.length, 2);
  assert.equal(filterConversations([c], {query: 'secret'}).length, 1);
  assert.doesNotMatch(toMarkdown([c]), /Rejected secret/);
});
test('Claude structured content and attachment references are retained', () => {
  const c = parseExport([claude()]).chats[0];
  assert.equal(c.messages[0].role, 'user');
  assert.match(c.messages[0].text, /tiếng Việt/);
  assert.match(c.messages[0].text, /image retained/);
  assert.equal(c.messages[0].attachmentCount, 1);
  assert.deepEqual(c.raw, claude());
});
test('reimport preserves organization, refuses older snapshots, separates providers', () => {
  const c = {...parseExport([gpt()]).chats[0], starred: true, projectId: 'p1'};
  const old = {...c, updatedAt: '2000-01-01T00:00:00Z'};
  assert.equal(mergeConversations([c], [old]).skipped, 1);
  const result = mergeConversations([c], [parseExport([gpt()]).chats[0], parseExport([claude()]).chats[0]]);
  assert.equal(result.chats.length, 2); assert.equal(result.chats[0].starred, true); assert.equal(result.chats[0].projectId, 'p1');
});
test('cyclic mapping terminates and unrecognized records are reported', () => {
  const raw = gpt(); raw.mapping.a.parent = 'b';
  assert.equal(activeMessages(parseExport([raw]).chats[0]).length, 2);
  assert.equal(parseExport([raw, {other: true}]).warnings.length, 1);
  assert.throws(() => parseExport([{other: true}]));
  assert.throws(() => parseExport(null));
});
test('backup validates version and reconstructs normalized content from raw source', () => {
  const chat = {...parseExport([gpt()]).chats[0], starred: true, projectId: 'p1'};
  const backup = {format: 'threadkeep', schemaVersion: 1, chats: [chat], projects: [{id: 'p1', name: 'Game'}]};
  const roundTrip = validateBackup(JSON.parse(JSON.stringify(backup)));
  assert.equal(roundTrip.chats[0].starred, true); assert.equal(roundTrip.chats[0].projectId, 'p1');
  assert.equal(activeMessages(roundTrip.chats[0])[1].text, 'Active idea');
  assert.throws(() => validateBackup({...backup, schemaVersion: 2}));
  assert.throws(() => validateBackup({...backup, chats: [chat, chat]}));
  assert.throws(() => validateBackup({...backup, chats: [{...chat, id: 'different'}]}));
});
test('search combines words and provider/project filters', () => {
  const chats = parseExport([gpt(), claude()]).chats; chats[0].projectId = 'p1';
  assert.equal(filterConversations(chats, {query: 'fantasy ACTIVE', projectId: 'p1', provider: 'chatgpt'}).length, 1);
  assert.equal(filterConversations(chats, {query: 'fantasy', provider: 'claude'}).length, 0);
});
test('handoff states uncertainty, cites messages, and signals truncation', () => {
  const c = parseExport([gpt()]).chats[0];
  assert.match(toHandoff([c]), /NOT an AI summary/);
  assert.match(toHandoff([c]), /message m2/);
  assert.match(toHandoff([c], 10), /Packet truncated/);
  assert.doesNotMatch(toHandoff([c]), /Rejected secret/);
});
test('mapping keys cannot poison object prototypes', () => {
  const raw = gpt(); raw.mapping = JSON.parse('{"__proto__":{"parent":null,"children":[],"message":{"id":"x","author":{"role":"user"},"content":{"parts":["safe"]}}}}'); raw.current_node = '__proto__';
  assert.equal(activeMessages(parseExport([raw]).chats[0])[0].text, 'safe');
  assert.equal({}.polluted, undefined);
});
