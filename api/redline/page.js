import { gunzipSync } from 'node:zlib';
import p00 from './page-parts/part00.js';
import p01 from './page-parts/part01.js';
import p02 from './page-parts/part02.js';
import p03 from './page-parts/part03.js';
import p04 from './page-parts/part04.js';
import p05 from './page-parts/part05.js';
import p06 from './page-parts/part06.js';
import p07 from './page-parts/part07.js';
import p08 from './page-parts/part08.js';
import p09 from './page-parts/part09.js';
import p10 from './page-parts/part10.js';
import p11 from './page-parts/part11.js';
import p12 from './page-parts/part12.js';
import p13 from './page-parts/part13.js';

const payload = [p00,p01,p02,p03,p04,p05,p06,p07,p08,p09,p10,p11,p12,p13].join('');
let cachedHtml = null;

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    if (!cachedHtml) cachedHtml = gunzipSync(Buffer.from(payload, 'base64')).toString('utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.status(200).send(cachedHtml);
  } catch (error) {
    console.error('RED LINE R12 page decode failed', error);
    return res.status(500).send('RED LINE page decode failed');
  }
}
