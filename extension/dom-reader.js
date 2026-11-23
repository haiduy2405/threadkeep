// Experimental DOM adapters. No provider API, cookies, page storage or credentials are read.
function threadkeepSource(href, requireConversation = true) {
  const url = new URL(href), config = globalThis.threadkeepProviders?.find(p => p.origin === url.origin || p.loopback && ['localhost', '127.0.0.1'].includes(url.hostname));
  if (!config || !(url.protocol === 'https:' || config.loopback && url.protocol === 'http:') || url.username || url.password) throw new Error('Open a supported AI website first.');
  const match = url.pathname.match(new RegExp(config.path));
  if (requireConversation && !match) throw new Error('Open a saved conversation on a supported AI website first.');
  return {url, config, sourceId: match?.[1]};
}
function threadkeepRole(node, config) {
  const explicit = config.roleAttribute && node.getAttribute(config.roleAttribute);
  if (['user', 'assistant', 'system', 'tool'].includes(explicit)) return explicit;
  const user = node.matches(config.user), assistant = node.matches(config.assistant);
  if (user !== assistant) return user ? 'user' : 'assistant';
  // Some layouts wrap a semantic role node in a visual message container.
  const nestedUser = !!node.querySelector(config.user), nestedAssistant = !!node.querySelector(config.assistant);
  if (nestedUser !== nestedAssistant) return nestedUser ? 'user' : 'assistant';
  throw new Error('Cannot safely identify message authors in this layout. Capture was stopped.');
}
function threadkeepExtract(doc, href) {
  const {url: u, config, sourceId} = threadkeepSource(href);
  if (doc.querySelector(config.stop)) throw new Error('Wait for the response to finish before saving.');
  const selector = config.roots;
  const roots = [...doc.querySelectorAll(selector)].filter(node => !node.parentElement?.closest(selector));
  const messages = roots.map((node, i) => {
    const role = threadkeepRole(node, config);
    const clone = node.cloneNode(true);
    clone.querySelectorAll('button, script, style, nav, textarea, input, [aria-hidden="true"]').forEach(n => n.remove());
    clone.querySelectorAll('br').forEach(n => n.replaceWith('\n'));
    clone.querySelectorAll('p, pre, li, h1, h2, h3, h4, div, tr').forEach(n => n.append('\n'));
    const text = clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
    return {id: node.getAttribute('data-message-id') || `dom-${i}`, role, text};
  }).filter(m => ['user', 'assistant', 'system', 'tool'].includes(m.role) && m.text);
  if (!messages.length) throw new Error('No supported messages found. The page may still be loading or its layout may have changed.');
  const title = (doc.title || 'Conversation').replace(new RegExp('\\s*[-—|]\\s*' + config.label + '\\s*$', 'i'), '').trim().slice(0, 500) || 'Conversation';
  return {threadkeep_capture: 1, provider: config.id, sourceId, sourceUrl: u.origin + u.pathname, title, capturedAt: new Date().toISOString(), messages, coverage: 'rendered-text-only; branches and media bytes not included'};
}
function threadkeepLinks(doc, href) {
  const {url: source, config} = threadkeepSource(href, false), found = new Map();
  for (const anchor of doc.querySelectorAll('a[href]')) {
    let url; try { url = new URL(anchor.getAttribute('href'), href); } catch { continue; }
    if (url.origin !== source.origin) continue;
    if (url.username || url.password) continue;
    const match = url.pathname.match(new RegExp(config.path));
    if (!match) continue;
    const canonical = url.origin + url.pathname.replace(/\/$/, '');
    found.set(match[1], {url: canonical, title: (anchor.textContent.trim() || canonical).slice(0, 500)});
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
