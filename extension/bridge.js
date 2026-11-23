// This script runs only on the exact configured Threadkeep app paths.
(() => {
  const allowed = location.origin === 'https://haiduy2405.github.io' && location.pathname.startsWith('/threadkeep/') || location.origin === 'http://127.0.0.1:4317';
  if (!allowed) return;
  const send = data => window.postMessage({channel: 'threadkeep-extension', ...data}, location.origin);
  async function pull() {
    try {
      const hello = await chrome.runtime.sendMessage({type: 'THREADKEEP_HELLO'});
      send({type: 'CONNECTED', version: hello?.version});
      const result = await chrome.runtime.sendMessage({type: 'THREADKEEP_PULL'});
      if (result?.batch) send({type: 'CAPTURE_BATCH', batch: result.batch});
    } catch { /* The app remains usable if the extension is reloaded. */ }
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'threadkeep-app') return;
    if (event.data.type === 'READY') pull();
    if (event.data.type === 'ACK' && typeof event.data.id === 'string') chrome.runtime.sendMessage({type: 'THREADKEEP_ACK', id: event.data.id}).catch(() => {});
  });
  pull();
})();
