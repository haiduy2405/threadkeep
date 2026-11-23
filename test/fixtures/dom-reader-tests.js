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
for (const result of results) { const row = document.createElement('li'); row.textContent = `${result.pass ? 'PASS' : 'FAIL'}: ${result.name}${result.error ? ' — ' + result.error : ''}`; document.getElementById('results').append(row); }
document.getElementById('summary').textContent = `${results.filter(r => r.pass).length}/${results.length} DOM fixture checks passed`;
