import { del } from '@vercel/blob';
import { json, methodNotAllowed } from '../_lib/http.js';

function validBlobUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com') && u.pathname.includes('redline');
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (!validBlobUrl(body.url)) return json(res, 400, { error: 'Invalid cleanup URL.' });
    await del(body.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('REDLINE_STEM_CLEANUP_ERROR', error?.message || error);
    return json(res, 500, { error: 'Unable to clean up STEM input.' });
  }
}
