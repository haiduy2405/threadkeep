const appURL = url => {
  try { const u = new URL(url); return u.origin === 'https://haiduy2405.github.io' && u.pathname.startsWith('/threadkeep/') || u.origin === 'http://127.0.0.1:4317'; } catch { return false; }
};
chrome.action.onClicked.addListener(tab => {
  chrome.tabs.create({url: chrome.runtime.getURL('capture.html') + '?tab=' + tab.id});
});
let acknowledgements = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.tab || !appURL(sender.tab.url)) return;
  if (!['THREADKEEP_PULL', 'THREADKEEP_ACK', 'THREADKEEP_HELLO'].includes(message?.type)) return;
  (async () => {
    if (message.type === 'THREADKEEP_HELLO') return {version: chrome.runtime.getManifest().version};
    if (message.type === 'THREADKEEP_PULL') { const {pendingCapture} = await chrome.storage.local.get('pendingCapture'); return {batch: pendingCapture || null}; }
    const ack = acknowledgements.then(async () => {
      const {pendingCapture} = await chrome.storage.local.get('pendingCapture');
      if (pendingCapture?.id === message.id) { await chrome.storage.local.remove('pendingCapture'); return {acknowledged: true}; }
      return {acknowledged: false};
    });
    acknowledgements = ack.catch(() => {}); return ack;
  })().then(respond, error => respond({error: error.message}));
  return true;
});
