import { gunzipSync } from 'node:zlib';
import p00 from './redline-page-parts/part00.js';
import p01 from './redline-page-parts/part01.js';
import p02 from './redline-page-parts/part02.js';
import p03 from './redline-page-parts/part03.js';
import p04 from './redline-page-parts/part04.js';
import p05 from './redline-page-parts/part05.js';
import p06 from './redline-page-parts/part06.js';
import p07 from './redline-page-parts/part07.js';
import p08 from './redline-page-parts/part08.js';
import p09 from './redline-page-parts/part09.js';
import p10 from './redline-page-parts/part10.js';
import p11 from './redline-page-parts/part11.js';
import p12 from './redline-page-parts/part12.js';
import p13 from './redline-page-parts/part13.js';

const payload = [p00,p01,p02,p03,p04,p05,p06,p07,p08,p09,p10,p11,p12,p13].join('');
let cachedHtml = null;

export function getRedlineR12Html() {
  if (!cachedHtml) cachedHtml = gunzipSync(Buffer.from(payload, 'base64')).toString('utf8');
  return cachedHtml;
}
