// Experimental DOM adapters. No provider API, cookies, page storage or credentials are read.
function threadkeepExtract(doc, href) {
  const u = new URL(href), provider = u.hostname === 'chatgpt.com' ? 'chatgpt' : u.hostname === 'claude.ai' ? 'claude' : null;
  const match = provider === 'chatgpt' ? u.pathname.match(/^\/(?:g\/[^/]+\/)?c\/([a-zA-Z0-9_-]{6,128})\/?$/) : provider === 'claude' ? u.pathname.match(/^\/chat\/([a-zA-Z0-9_-]{6,128})\/?$/) : null;
  if (u.protocol !== 'https:' || !match) throw new Error('Open a saved ChatGPT or Claude conversation first.');
  if (doc.querySelector('button[data-testid="stop-button"], button[aria-label="Stop generating"], [data-is-streaming="true"]')) throw new Error('Wait for the response to finish before saving.');
  const selector = provider === 'chatgpt' ? '[data-message-author-role]' : '[data-testid="user-message"], [data-testid="assistant-message"], .font-user-message, .font-claude-response';
  const roots = [...doc.querySelectorAll(selector)].filter(node => !node.parentElement?.closest(selector));
  const messages = roots.map((node, i) => {
    const role = provider === 'chatgpt' ? node.getAttribute('data-message-author-role') : node.matches('[data-testid="user-message"], .font-user-message') ? 'user' : 'assistant';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('button, script, style, nav, textarea, input, [aria-hidden="true"]').forEach(n => n.remove());
    clone.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
    clone.querySelectorAll('p, pre, li, h1, h2, h3, h4, div, tr').forEach(n => n.append('\n'));
    const text = clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
    return {id: node.getAttribute('data-message-id') || `dom-${i}`, role, text};
  }).filter(m => ['user', 'assistant', 'system', 'tool'].includes(m.role) && m.text);
  if (!messages.length) throw new Error('No supported messages found. The page may still be loading or its layout may have changed.');
  const title = (doc.title || 'Conversation').replace(/\s*[-—|]\s*(ChatGPT|Claude)\s*$/i, '').trim().slice(0, 500) || 'Conversation';
  return {threadkeep_capture: 1, provider, sourceId: match[1], sourceUrl: u.origin + u.pathname, title, capturedAt: new Date().toISOString(), messages, coverage: 'rendered-text-only; branches and media bytes not included'};
}
function threadkeepLinks(doc, href) {
  const source = new URL(href), provider = source.hostname === 'chatgpt.com' ? 'chatgpt' : source.hostname === 'claude.ai' ? 'claude' : null, found = new Map();
  if (!provider || source.protocol !== 'https:') throw new Error('Open ChatGPT or Claude first.');
  for (const anchor of doc.querySelectorAll('a[href]')) {
    let url; try { url = new URL(anchor.getAttribute('href'), href); } catch { continue; }
    if (url.origin !== source.origin) continue;
    const pattern = provider === 'chatgpt' ? /^\/(?:g\/[^/]+\/)?c\/[a-zA-Z0-9_-]{6,128}\/?$/ : /^\/chat\/[a-zA-Z0-9_-]{6,128}\/?$/;
    if (!pattern.test(url.pathname)) continue;
    const canonical = url.origin + url.pathname.replace(/\/$/, '');
    found.set(canonical, {url: canonical, title: (anchor.textContent.trim() || canonical).slice(0, 500)});
  }
  return [...found.values()];
}
async function threadkeepRead(mode) {
  if (mode === 'read') {
    let previous = '', stable = 0, result, lastError;
    for (let i = 0; i < 30; i++) {
      try { result = threadkeepExtract(document, location.href); const fingerprint = JSON.stringify(result.messages); stable = fingerprint === previous ? stable + 1 : 0; previous = fingerprint; if (stable >= 3) return result; }
      catch (error) { lastError = error; stable = 0; result = null; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw lastError || new Error('The conversation did not become stable. Try again once it has finished loading.');
  }
  if (mode !== 'discover') throw new Error('Unknown reader mode.');
  const found = new Map(), scrollables = [...document.querySelectorAll('nav, aside, [role="navigation"], [data-radix-scroll-area-viewport]')].flatMap(root => [root, ...root.querySelectorAll('div')]).filter(n => n.scrollHeight > n.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(n).overflowY));
  const original = scrollables.map(node => node.scrollTop); let stable = 0;
  try {
    for (let round = 0; round < 30; round++) {
      const size = found.size;
      for (const item of threadkeepLinks(document, location.href)) found.set(item.url, item);
      if (found.size > 1000) return {items: [...found.values()].slice(0, 1000), coverage: 'discovered-only', stopped: '1000-link limit'};
      stable = found.size === size ? stable + 1 : 0;
      if (stable >= 4) break;
      for (const node of scrollables) node.scrollTop = node.scrollHeight;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  } finally { scrollables.forEach((node, i) => node.scrollTop = original[i]); }
  return {items: [...found.values()], coverage: 'discovered-only', stopped: 'bounded DOM scan; full account coverage unverified'};
}
