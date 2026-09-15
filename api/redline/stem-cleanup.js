import { issueSignedToken, presignUrl } from '@vercel/blob';
import { json, methodNotAllowed } from '../_lib/http.js';

function blobToken() {
  const value = String(process.env.REDLINE_STEM_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!value) throw new Error('RED LINE STEM Blob token is not configured.');
  return value;
}
function validPathname(value) {
  const pathname = String(value || '').replace(/^\/+/, '');
  return pathname.startsWith('redline/stem-input/') && !pathname.includes('..') && pathname.length <= 240;
}
function extractPath(value) {
  try {
    const u = new URL(String(value || ''));
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (!(host === 'blob.vercel-storage.com' || host.endsWith('.blob.vercel-storage.com'))) return null;
    const candidates = [u.pathname.replace(/^\/+/, ''), u.searchParams.get('pathname'), u.searchParams.get('path')].filter(Boolean);
    for (const candidate of candidates) {
      let pathname = String(candidate || '');
      for (let i = 0; i < 2; i++) {
        try { pathname = decodeURIComponent(pathname); } catch { break; }
      }
      pathname = pathname.replace(/^\/+/, '');
      if (validPathname(pathname)) return pathname;
    }
    return null;
  } catch {
    return null;
  }
}
async function deletePath(pathname) {
  const validUntil = Date.now() + 5 * 60 * 1000;
  const signedToken = await issueSignedToken({
    pathname,
    operations: ['delete'],
    validUntil,
    token: blobToken()
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: 'delete',
    pathname,
    access: 'private',
    validUntil
  });
  const r = await fetch(presignedUrl, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`Blob delete failed (${r.status})`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const pathname = validPathname(body.pathname) ? String(body.pathname).replace(/^\/+/, '') : extractPath(body.url);
    if (!pathname) return json(res, 400, { error: 'Invalid cleanup target.' });
    await deletePath(pathname);
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('REDLINE_STEM_CLEANUP_ERROR', error?.message || error);
    return json(res, 500, { error: 'Unable to clean up STEM input.' });
  }
}
