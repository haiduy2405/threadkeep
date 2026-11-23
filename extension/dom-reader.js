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
  return threadkeepDiscover(document, location.href);
}
async function threadkeepDiscover(doc, href, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const found = new Map(), original = new Map(); let stable = 0, stopped = 'scan-limit';
  const collect = () => { for (const item of threadkeepLinks(doc, href)) found.set(item.url, item); };
  // Walk ancestors of actual history links: scroll viewports can sit OUTSIDE nav/aside.
  // Recompute each round because providers replace their sidebar during pagination.
  const viewports = () => {
    const candidates = new Set(doc.querySelectorAll('nav, aside, [role="navigation"], [data-radix-scroll-area-viewport]'));
    for (const a of doc.querySelectorAll('a[href]')) {
      if (!threadkeepLinks({querySelectorAll: () => [a]}, href).length) continue;
      for (let node = a.parentElement; node; node = node.parentElement) candidates.add(node);
    }
    return [...candidates].filter(node => node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 2 && /auto|scroll|overlay/.test(getComputedStyle(node).overflowY));
  };
  try {
    collect();
    for (let round = 0; round < 90; round++) {
      const size = found.size, scrollables = viewports(); let moved = false;
      for (const node of scrollables) {
        if (!original.has(node)) { original.set(node, node.scrollTop); node.scrollTop = 0; collect(); }
        const before = node.scrollTop;
        // Overlapping steps retain links in virtualized lists; jumping to the end loses them.
        node.scrollTop = Math.min(node.scrollHeight - node.clientHeight, before + Math.max(1, node.clientHeight * .8));
        moved ||= node.scrollTop > before + 1;
      }
      await pause(600); collect();
      if (found.size >= 1000) { stopped = '1000-link limit'; break; }
      stable = !moved && found.size === size ? stable + 1 : 0;
      if (stable >= 8) { stopped = scrollables.length ? 'loaded-history-end' : 'no-history-scroll-container'; break; }
    }
  } finally { for (const [node, position] of original) node.scrollTop = position; }
  return {items: [...found.values()].slice(0, 1000), coverage: 'discovered-only', stopped};
}
