// Shared with the browser extension by scripts/package-extension.mjs.
export const CAPTURE_LIMIT = 2 * 1024 * 1024;
export const BATCH_LIMIT = 8 * 1024 * 1024;
export function conversationURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const provider = url.hostname === 'chatgpt.com' ? 'chatgpt' : url.hostname === 'claude.ai' ? 'claude' : null;
    const match = provider === 'chatgpt' ? url.pathname.match(/^\/(?:g\/[^/]+\/)?c\/([a-zA-Z0-9_-]{6,128})\/?$/) : provider === 'claude' ? url.pathname.match(/^\/chat\/([a-zA-Z0-9_-]{6,128})\/?$/) : null;
    return match ? {provider, sourceId: match[1], url: url.origin + url.pathname.replace(/\/$/, '')} : null;
  } catch { return null; }
}
export function normalizeCapture(raw) {
  if (new TextEncoder().encode(JSON.stringify(raw)).length > CAPTURE_LIMIT) throw new Error('Capture exceeds the 2 MB per-conversation limit.');
  const source = conversationURL(raw?.sourceUrl);
  if (raw?.threadkeep_capture !== 1 || !source || source.provider !== raw.provider || source.sourceId !== raw.sourceId) throw new Error('Invalid capture source.');
  const accountLabel = typeof raw.accountLabel === 'string' ? raw.accountLabel.trim() : '';
  if (!accountLabel || accountLabel.length > 64) throw new Error('Enter an account label (1–64 characters).');
  if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 500 || !Array.isArray(raw.messages) || !raw.messages.length || raw.messages.length > 5000) throw new Error('Invalid captured conversation.');
  if (typeof raw.capturedAt !== 'string' || !Number.isFinite(Date.parse(raw.capturedAt))) throw new Error('Invalid capture date.');
  const messages = raw.messages.map((m, i) => {
    if (!m || !['user', 'assistant', 'system', 'tool'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 200000) throw new Error('Invalid captured message.');
    return {id: typeof m.id === 'string' && m.id.length < 200 ? m.id : `dom-${i}`, role: m.role, text: m.text, createdAt: null};
  });
  return {
    id: `capture:${source.provider}:${encodeURIComponent(accountLabel.toLocaleLowerCase())}:${source.sourceId}`,
    provider: source.provider, sourceId: source.sourceId, sourceUrl: source.url, accountLabel,
    title: raw.title.trim(), createdAt: null, updatedAt: null, capturedAt: new Date(raw.capturedAt).toISOString(),
    captureScope: 'rendered-text', messages,
    raw: {...raw, sourceUrl: source.url, accountLabel, messages, coverage: 'rendered-text-only; branches and media bytes not included'}
  };
}
export function normalizeCaptureBatch(batch) {
  if (!batch || batch.format !== 'threadkeep-capture-batch' || batch.version !== 1 || typeof batch.id !== 'string' || batch.id.length > 100 || !Array.isArray(batch.captures) || !batch.captures.length || batch.captures.length > 100) throw new Error('Invalid capture batch.');
  if (new TextEncoder().encode(JSON.stringify(batch)).length > BATCH_LIMIT) throw new Error('Capture batch exceeds the 8 MB limit.');
  const chats = batch.captures.map(normalizeCapture);
  if (new Set(chats.map(c => c.id)).size !== chats.length) throw new Error('Duplicate conversations in capture batch.');
  return chats;
}
