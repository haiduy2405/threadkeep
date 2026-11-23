import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
test('local server serves all browser modules, blocks private source, and sets security headers', async () => {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], {cwd: new URL('../', import.meta.url), env: {...process.env, PORT: '0', THREADKEEP_TEST: '0'}, stdio: ['ignore', 'pipe', 'pipe']});
  try {
    const origin = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
      child.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    });
    for (const path of ['/', '/src/app.js', '/src/core.js', '/src/storage.js', '/src/i18n.js', '/src/capture.js', '/src/providers.js', '/src/style.css', '/src/theme.css', '/icon.svg']) {
      const response = await fetch(origin + path); assert.equal(response.status, 200, path);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
    }
    for (const path of ['/package.json', '/.git/config', '/src/../README.md', '/test/fixtures/dom-reader.html', '/extension/dom-reader.js']) assert.equal((await fetch(origin + path)).status, 404, path);
    assert.doesNotMatch(await (await fetch(origin + '/?simulate-capture=1')).text(), /src="\/test\/fixtures\/capture-transport.js"/);
    assert.equal((await fetch(origin, {method: 'POST'})).status, 405);
  } finally { child.kill(); }
});
