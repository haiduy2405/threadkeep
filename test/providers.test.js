import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {providers, providerForURL} from '../src/providers.js';
import {conversationURL, normalizeCapture} from '../src/capture.js';
import {validateBackup, toMarkdown, filterConversations} from '../src/core.js';
const samples = [
  ['gemini', 'https://gemini.google.com/app/gemini-chat-001'],
  ['gemini', 'https://gemini.google.com/u/1/app/gemini-chat-001'],
  ['deepseek', 'https://chat.deepseek.com/a/chat/s/deepseek-chat-001'],
  ['grok', 'https://grok.com/c/grok-chat-001'],
  ['openwebui', 'http://localhost:3000/c/local-chat-001'],
  ['openwebui', 'http://127.0.0.1:8080/c/local-chat-001']
];
const raw = (provider, sourceUrl) => ({threadkeep_capture: 1, provider, sourceId: conversationURL(sourceUrl).sourceId, sourceUrl, title: 'Synthetic ' + provider, accountLabel: 'Test account', capturedAt: '2026-11-23T12:00:00Z', messages: [{role: 'user', text: 'Tiếng Việt stays unchanged.'}, {role: 'assistant', text: 'Synthetic answer'}]});
test('new provider and loopback route validation is exact; spoofed hosts, endpoints and ports fail', () => {
  for (const [provider, url] of samples) assert.equal(conversationURL(url)?.provider, provider, url);
  for (const url of ['https://gemini.google.com.evil.test/app/fake12345', 'http://gemini.google.com/app/fake12345', 'https://chatgpt.com:8443/c/fake12345', 'https://grok.com/share/fake12345', 'http://192.168.1.10/c/fake12345', 'http://localhost.evil.test/c/fake12345', 'http://localhost:11434/api/chat', 'http://localhost:1234/v1/chat/completions']) assert.equal(conversationURL(url), null, url);
  assert.equal(providerForURL('https://x.com/i/grok'), null);
});
test('all captured provider types survive backup, filtering and source-linked Markdown', () => {
  for (const [provider, url] of samples) {
    const chat = normalizeCapture(raw(provider, url));
    const restored = validateBackup({format: 'threadkeep', schemaVersion: 1, chats: [chat], projects: []});
    assert.equal(restored.chats[0].provider, provider);
    assert.equal(filterConversations(restored.chats, {provider}).length, 1);
    assert.ok(toMarkdown([chat]).includes(url));
    assert.match(toMarkdown([chat], 'vi'), /Tiếng Việt stays unchanged/);
  }
});
test('different local servers never collide even with the same account label and conversation ID', () => {
  const first = normalizeCapture(raw('openwebui', 'http://localhost:3000/c/local-chat-001'));
  const second = normalizeCapture(raw('openwebui', 'http://localhost:8080/c/local-chat-001'));
  assert.notEqual(first.id, second.id);
});
test('generated provider configurations, permission boundaries and copies agree', () => {
  assert.equal(readFileSync(new URL('../src/providers.js', import.meta.url), 'utf8'), readFileSync(new URL('../extension/providers.js', import.meta.url), 'utf8'));
  const context = {}; runInNewContext(readFileSync(new URL('../extension/provider-registry.js', import.meta.url), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.threadkeepProviders)), providers);
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url)));
  for (const p of providers.filter(p => !p.loopback)) assert.ok(manifest.optional_host_permissions.includes(p.origin + '/*'));
  assert.ok(!manifest.optional_host_permissions.some(pattern => pattern.includes('192.168.') || pattern === '<all_urls>'));
  assert.ok(manifest.optional_host_permissions.includes('http://localhost/*'));
});
