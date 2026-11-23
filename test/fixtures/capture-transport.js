// Only injected by the local test server when explicitly enabled; never by GitHub Pages.
const batch = {format: 'threadkeep-capture-batch', version: 1, id: 'synthetic-transport-batch-001', captures: [{threadkeep_capture: 1, provider: 'chatgpt', sourceId: 'synthetic-capture-001', sourceUrl: 'https://chatgpt.com/c/synthetic-capture-001', title: 'Synthetic extension transport test', accountLabel: 'Synthetic fixture', capturedAt: '2026-11-23T12:00:00Z', messages: [{id: 'fixture-m1', role: 'user', text: 'Fictional fixture: keep <script> as inert text.'}, {id: 'fixture-m2', role: 'assistant', text: 'This is a simulated content-script delivery, not a real provider capture.'}]}]};
const controls = document.createElement('div'), button = document.createElement('button'), result = document.createElement('span');
controls.id = 'synthetic-transport-controls'; button.textContent = 'Send synthetic capture (test only)';
button.onclick = () => { window.postMessage({channel: 'threadkeep-extension', type: 'CAPTURE_BATCH', batch}, location.origin); };
controls.append(button, result); document.body.prepend(controls);
window.addEventListener('message', event => { if (event.source === window && event.data?.channel === 'threadkeep-app' && event.data.type === 'ACK') result.textContent = ' Test bridge received durable-save acknowledgement: ' + event.data.id; });
