import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const partsDir = path.join(root, 'redline', 'page-parts');
const outputFile = path.join(root, 'redline', 'index.html');

const chunks = [];
for (let i = 0; i < 14; i += 1) {
  const name = `part${String(i).padStart(2, '0')}.js`;
  const source = fs.readFileSync(path.join(partsDir, name), 'utf8');
  const match = source.match(/^export\s+default\s+'([A-Za-z0-9+/=_-]+)'\s*;?\s*$/s);
  if (!match) throw new Error(`Invalid RED LINE payload part: ${name}`);
  chunks.push(match[1]);
}

let payload = chunks.join('')
  .replace(/\s+/g, '')
  .replace(/-/g, '+')
  .replace(/_/g, '/')
  .replace(/[^A-Za-z0-9+/=]/g, '');

payload = payload.replace(/=/g, '');
payload += '='.repeat((4 - (payload.length % 4)) % 4);

const compressed = Buffer.from(payload, 'base64');
if (compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
  throw new Error('RED LINE payload is not valid gzip data.');
}

const html = gunzipSync(compressed).toString('utf8');
if (!html.includes('<html') || !html.includes('NOVA RED LINE')) {
  throw new Error('RED LINE HTML verification failed.');
}

fs.writeFileSync(outputFile, html, 'utf8');
console.log(`RED LINE single-file build complete: ${html.length} chars -> redline/index.html`);
