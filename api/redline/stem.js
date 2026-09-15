import { issueSignedToken, presignUrl } from '@vercel/blob';
import { json, methodNotAllowed, queryParam } from '../_lib/http.js';

const VERSION = '5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77';
const MODEL_VERSION = `ryan5453/demucs:${VERSION}`;
const API = 'https://api.replicate.com/v1/predictions';

function enabled() {
  return String(process.env.REDLINE_STEM_ENABLED || '').toLowerCase() === 'true';
}
function token() {
  const value = String(process.env.REPLICATE_API_TOKEN || '').trim();
  if (!value) { const error = new Error('STEM provider is not configured.'); error.code = 'CONFIG'; throw error; }
  return value;
}
function blobToken() {
  const value = String(process.env.REDLINE_STEM_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!value) { const error = new Error('STEM Blob store is not configured.'); error.code = 'CONFIG'; throw error; }
  return value;
}
function validPathname(value) {
  const pathname = String(value || '').replace(/^\/+/, '');
  return pathname.startsWith('redline/stem-input/') && !pathname.includes('..') && pathname.length <= 240;
}
function extractBlobPath(value) {
  try {
    const u = new URL(String(value || ''));
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (!(host === 'blob.vercel-storage.com' || host.endsWith('.blob.vercel-storage.com'))) return null;

    const candidates = [
      u.pathname.replace(/^\/+/, ''),
      u.searchParams.get('pathname'),
      u.searchParams.get('path')
    ].filter(Boolean);

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
async function signedInputPath(pathname) {
  if (!validPathname(pathname)) throw new Error('Invalid audio upload path.');
  const signedToken = await issueSignedToken({
    pathname,
    operations: ['get'],
    validUntil: Date.now() + 60 * 60 * 1000,
    token: blobToken()
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: 'get',
    pathname,
    access: 'private',
    validUntil: Date.now() + 45 * 60 * 1000
  });
  return presignedUrl;
}
async function cleanupPath(pathname) {
  if (!validPathname(pathname)) return;
  try {
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
    await fetch(presignedUrl, { method: 'DELETE' });
  } catch (error) {
    console.warn('REDLINE_STEM_BLOB_CLEANUP_WARNING', error?.message || error);
  }
}
function normalizeOutput(output) {
  if (!output) return null;

  let raw = output;
  if (output.stems && Array.isArray(output.stems)) {
    raw = Object.fromEntries(
      output.stems
        .map((item) => [String(item.name || '').toLowerCase(), item.audio])
        .filter(([k,v]) => k && v)
    );
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;

  const vocals = raw.vocals || raw.vocal || raw.voice || null;
  const mr = raw.no_vocals || raw.instrumental || raw.accompaniment || raw.mr || raw.other || null;

  if (vocals || mr) {
    return {
      vocals,
      mr,
      no_vocals: mr,
      other: mr
    };
  }
  return raw;
}
function providerDetail(data, status) {
  const raw = data?.detail || data?.error || data?.message || `Provider error ${status}`;
  return typeof raw === 'string' ? raw.slice(0, 500) : JSON.stringify(raw).slice(0, 500);
}
async function replicate(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(providerDetail(data, response.status));
    error.code = 'PROVIDER';
    error.status = response.status;
    throw error;
  }
  return data;
}
function predictionInput(audio) {
  return {
    audio,
    model: 'htdemucs',
    stem: 'vocals',
    output_format: 'wav',
    wav_format: 'int24',
    clip_mode: 'rescale',
    shifts: 1,
    overlap: 0.25,
    split: true,
    jobs: 0
  };
}

export default async function handler(req, res) {
  if (!enabled()) return json(res, 503, { error: 'STEM engine is not enabled yet.' });
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const pathname = validPathname(body.audioPath) ? String(body.audioPath).replace(/^\/+/, '') : extractBlobPath(body.audioUrl);
      if (!pathname) return json(res, 400, { error: 'Invalid audio upload URL.' });

      const audio = await signedInputPath(pathname);
      const prediction = await replicate(API, {
        method: 'POST',
        body: JSON.stringify({ version: MODEL_VERSION, input: predictionInput(audio) })
      });
      return json(res, 202, { id: prediction.id, status: prediction.status, mode: 'vocal-mr' });
    }

    if (req.method === 'GET') {
      const id = String(queryParam(req, 'id') || '').trim();
      if (!/^[a-z0-9_-]{6,80}$/i.test(id)) return json(res, 400, { error: 'Invalid STEM job id.' });
      const prediction = await replicate(`${API}/${encodeURIComponent(id)}`);
      if (['succeeded','failed','canceled'].includes(prediction.status)) {
        const pathname = extractBlobPath(prediction?.input?.audio);
        if (pathname) await cleanupPath(pathname);
      }
      return json(res, 200, {
        id: prediction.id,
        status: prediction.status,
        error: prediction.error || null,
        output: prediction.status === 'succeeded' ? normalizeOutput(prediction.output) : null,
        metrics: prediction.metrics || null,
        mode: 'vocal-mr'
      });
    }

    if (req.method === 'DELETE') {
      const id = String(queryParam(req, 'id') || '').trim();
      if (!/^[a-z0-9_-]{6,80}$/i.test(id)) return json(res, 400, { error: 'Invalid STEM job id.' });
      const prediction = await replicate(`${API}/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      const pathname = extractBlobPath(prediction?.input?.audio);
      if (pathname) await cleanupPath(pathname);
      return json(res, 200, { id: prediction.id, status: prediction.status });
    }

    return methodNotAllowed(res, ['GET','POST','DELETE']);
  } catch (error) {
    console.error('REDLINE_STEM_API_ERROR', error?.message || error);
    if (error?.code === 'CONFIG') return json(res, 503, { error: error.message });
    if (error?.code === 'PROVIDER') return json(res, 502, { error: `Replicate ${error.status}: ${error.message}` });
    return json(res, 502, { error: `STEM processing failed: ${String(error?.message || 'unknown error').slice(0, 300)}` });
  }
}
