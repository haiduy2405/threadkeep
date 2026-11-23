const results = [], parse = html => new DOMParser().parseFromString(html, 'text/html');
function assert(value, message) { if (!value) throw new Error(message); }
function test(name, fn) { try { fn(); results.push({name, pass: true}); } catch (error) { results.push({name, pass: false, error: error.message}); } }
test('ChatGPT role nodes preserve code and remove controls; nested roots are deduplicated', () => {
  const doc = parse('<title>A plan — ChatGPT</title><main><div data-message-author-role="user" data-message-id="a"><p>Hello</p><button>Copy</button><div data-message-author-role="user"><p>Nested content</p></div></div><div data-message-author-role="assistant"><pre><code>const x = 1;</code></pre><p>Next paragraph</p></div></main>');
  const chat = threadkeepExtract(doc, 'https://chatgpt.com/c/synthetic-thread-001');
  assert(chat.messages.length === 2, 'Expected two top-level messages'); assert(chat.title === 'A plan', 'Title suffix was not removed');
  assert(!chat.messages[0].text.includes('Copy'), 'Control text leaked'); assert(chat.messages[1].text.includes('const x = 1;\n'), 'Code/newline missing');
});
test('Claude test IDs and class selectors preserve order and roles', () => {
  const doc = parse('<title>Claude plan | Claude</title><div data-testid="user-message"><div class="font-user-message">Question</div></div><div class="font-claude-response"><p>Answer</p><button>Retry</button></div>');
  const chat = threadkeepExtract(doc, 'https://claude.ai/chat/synthetic-thread-002');
  assert(chat.messages.length === 2, 'Nested user message duplicated'); assert(chat.messages[0].role === 'user' && chat.messages[1].role === 'assistant', 'Incorrect message roles'); assert(!chat.messages[1].text.includes('Retry'), 'Control text leaked');
});
test('Loading/unsupported pages and streaming messages fail explicitly', () => {
  for (const html of ['<main>Sign in</main>', '<button data-testid="stop-button">Stop</button><div data-message-author-role="assistant">Partial</div>']) {
    let failed = false; try { threadkeepExtract(parse(html), 'https://chatgpt.com/c/synthetic-thread-001'); } catch { failed = true; } assert(failed, 'An unsupported page was reported as saved');
  }
});
test('Discovery excludes external links, settings, unsafe schemes and duplicate links', () => {
  const doc = parse('<a href="/c/synthetic-thread-001?x=1">One</a><a href="/c/synthetic-thread-001">One again</a><a href="https://evil.test/c/synthetic-thread-001">Bad</a><a href="javascript:alert(1)">Bad</a><a href="/settings">Settings</a>');
  const links = threadkeepLinks(doc, 'https://chatgpt.com/'); assert(links.length === 1, 'Discovery included unsafe/duplicate links'); assert(!links[0].url.includes('?'), 'Query string was retained');
});
test('Plain text containing HTML-like characters stays text', () => {
  const chat = threadkeepExtract(parse('<div data-message-author-role="user">&lt;script&gt;not executable&lt;/script&gt;</div>'), 'https://chatgpt.com/c/synthetic-thread-001');
  assert(chat.messages[0].text === '<script>not executable</script>', 'Text changed');
});
test('Gemini custom elements preserve user/model order and source identity', () => {
  const chat = threadkeepExtract(parse('<title>A Gemini plan — Gemini</title><user-query><p>User prompt</p></user-query><model-response><p>Model answer</p></model-response>'), 'https://gemini.google.com/u/1/app/gemini-chat-001');
  assert(chat.provider === 'gemini' && chat.messages.length === 2, 'Gemini identity/count mismatch'); assert(chat.messages[0].role === 'user' && chat.messages[1].role === 'assistant', 'Wrong Gemini roles');
});
test('DeepSeek/Grok semantic author markers are recognized without guessing alignment', () => {
  for (const [provider, url, cls] of [['deepseek', 'https://chat.deepseek.com/a/chat/s/deepseek-chat-001', 'ds-message'], ['grok', 'https://grok.com/c/grok-chat-001', 'message-bubble']]) {
    const chat = threadkeepExtract(parse(`<div class="${cls}" data-role="user">Question</div><div class="${cls}" data-role="assistant">Answer</div>`), url);
    assert(chat.provider === provider && chat.messages[0].role === 'user' && chat.messages[1].role === 'assistant', 'Semantic roles mismatch');
    let failed = false; try { threadkeepExtract(parse(`<div class="${cls}">Ambiguous author</div>`), url); } catch (error) { failed = error.message.includes('Cannot safely identify'); }
    assert(failed, 'Ambiguous author should stop capture');
  }
});
test('Open WebUI uses explicit chat-role containers on a loopback source', () => {
  const chat = threadkeepExtract(parse('<div class="chat-user">Local prompt</div><div class="chat-assistant">Local answer</div>'), 'http://127.0.0.1:8080/c/local-chat-001');
  assert(chat.provider === 'openwebui' && chat.messages.length === 2, 'Open WebUI extraction failed'); assert(chat.sourceUrl.startsWith('http://127.0.0.1:8080/'), 'Local origin was not preserved');
});
test('Discovery works for each new provider and rejects cross-provider links', () => {
  for (const url of ['https://gemini.google.com/app/gemini-chat-001', 'https://chat.deepseek.com/a/chat/s/deepseek-chat-001', 'https://grok.com/c/grok-chat-001', 'http://localhost:3000/c/local-chat-001']) {
    const doc = parse(`<a href="${url}">Saved conversation</a><a href="https://evil.test/c/fake-chat-001">Bad</a>`);
    assert(threadkeepLinks(doc, url).length === 1, 'New-provider link discovery failed');
  }
});
for (const result of results) { const row = document.createElement('li'); row.textContent = `${result.pass ? 'PASS' : 'FAIL'}: ${result.name}${result.error ? ' — ' + result.error : ''}`; document.getElementById('results').append(row); }
document.getElementById('summary').textContent = `${results.filter(r => r.pass).length}/${results.length} DOM fixture checks passed`;
