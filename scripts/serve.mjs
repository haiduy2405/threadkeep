import {createServer} from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 4317);
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.zip': 'application/zip'};
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Method not allowed'); }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const devFixture = process.env.THREADKEEP_TEST === '1' && (/^test\/fixtures\/[a-z-]+\.(html|js)$/.test(relative) || ['extension/dom-reader.js', 'extension/provider-registry.js'].includes(relative));
    if (relative !== 'index.html' && relative !== 'icon.svg' && !/^downloads\/threadkeep-extension-v0\.[34]\.[01]\.zip$/.test(relative) && !/^src\/[a-z0-9-]+\.(js|css)$/.test(relative) && !devFixture) throw new Error('Not found');
    const path = await realpath(resolve(root, relative));
    if (!path.startsWith(root + sep)) throw new Error('Not found');
    let data = await readFile(path);
    if (process.env.THREADKEEP_TEST === '1' && relative === 'index.html' && new URL(req.url, 'http://localhost').searchParams.get('simulate-capture') === '1') data = Buffer.from(data.toString('utf8').replace('</body>', '<script type="module" src="/test/fixtures/capture-transport.js"></script></body>'));
    res.writeHead(200, {'Content-Type': types[extname(path)] || 'application/octet-stream'}); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Threadkeep: http://127.0.0.1:${server.address().port}`));
