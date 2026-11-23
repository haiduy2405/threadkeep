import {copyFile, readFile, mkdir} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await copyFile(new URL('src/i18n.js', root), new URL('extension/i18n.js', root));
await copyFile(new URL('src/capture.js', root), new URL('extension/capture-normalizer.js', root));
await mkdir(new URL('downloads/', root), {recursive: true});
// A small dependency-free ZIP writer using stored (uncompressed) entries.
const files = ['manifest.json', 'background.js', 'bridge.js', 'dom-reader.js', 'capture.html', 'capture.css', 'capture-ui.js', 'capture-normalizer.js', 'i18n.js', 'README.md'];
const crc32 = data => { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
const chunks = [], directory = []; let offset = 0;
for (const name of files) {
  const data = await readFile(new URL('extension/' + name, root)), filename = Buffer.from(name), crc = crc32(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
  chunks.push(local, filename, data); directory.push(central, filename); offset += local.length + filename.length + data.length;
}
const central = Buffer.concat(directory), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
const {writeFile} = await import('node:fs/promises');
await writeFile(new URL('downloads/threadkeep-extension-v0.3.0.zip', root), Buffer.concat([...chunks, central, end]));
console.log('Built downloads/threadkeep-extension-v0.3.0.zip');
