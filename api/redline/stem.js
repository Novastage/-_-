import { issueSignedToken, presignUrl, del } from '@vercel/blob';
import { json, methodNotAllowed, queryParam } from '../_lib/http.js';

const VERSION = '5a7041cc9b82e5a558fea6b3d7b12dea89625e89da33f0447bd727c2d0ab9e77';
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
function blobInfo(value) {
  try {
    const u = new URL(String(value));
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.blob.vercel-storage.com')) return null;
    const pathname = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
    if (!pathname.startsWith('redline/stem-input/') || pathname.includes('..')) return null;
    return { pathname, bareUrl: `${u.origin}${u.pathname}` };
  } catch { return null; }
}
function validBlobUrl(value) {
  return Boolean(blobInfo(value));
}
async function signedInputUrl(value) {
  const info = blobInfo(value);
  if (!info) throw new Error('Invalid audio upload URL.');
  const signedToken = await issueSignedToken({
    pathname: info.pathname,
    operations: ['get'],
    validUntil: Date.now() + 60 * 60 * 1000,
    token: blobToken()
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: 'get',
    pathname: info.pathname,
    access: 'private',
    validUntil: Date.now() + 45 * 60 * 1000,
    useCache: false
  });
  return presignedUrl;
}
async function cleanupInput(value) {
  const info = blobInfo(value);
  if (!info) return;
  try {
    await del(info.bareUrl, { token: blobToken() });
  } catch (error) {
    console.warn('REDLINE_STEM_BLOB_CLEANUP_WARNING', error?.message || error);
  }
}
function normalizeOutput(output) {
  if (!output) return null;
  if (output.stems && Array.isArray(output.stems)) {
    return Object.fromEntries(output.stems.map((item) => [String(item.name || '').toLowerCase(), item.audio]).filter(([k,v]) => k && v));
  }
  if (typeof output === 'object' && !Array.isArray(output)) return output;
  return null;
}
async function replicate(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || data?.error || `Provider error ${response.status}`);
  return data;
}

export default async function handler(req, res) {
  if (!enabled()) return json(res, 503, { error: 'STEM engine is not enabled yet.' });
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (!validBlobUrl(body.audioUrl)) return json(res, 400, { error: 'Invalid audio upload URL.' });
      const six = body.mode !== '4';
      const audio = await signedInputUrl(body.audioUrl);
      const prediction = await replicate(API, {
        method: 'POST',
        body: JSON.stringify({
          version: VERSION,
          input: {
            audio,
            model: six ? 'htdemucs_6s' : 'htdemucs_ft',
            stem: 'none',
            output_format: 'wav',
            wav_format: 'int24',
            clip_mode: 'rescale',
            shifts: 1,
            overlap: 0.25,
            split: true,
            jobs: 0
          }
        })
      });
      return json(res, 202, { id: prediction.id, status: prediction.status });
    }
    if (req.method === 'GET') {
      const id = String(queryParam(req, 'id') || '').trim();
      if (!/^[a-z0-9_-]{6,80}$/i.test(id)) return json(res, 400, { error: 'Invalid STEM job id.' });
      const prediction = await replicate(`${API}/${encodeURIComponent(id)}`);
      if (['succeeded','failed','canceled'].includes(prediction.status)) {
        await cleanupInput(prediction?.input?.audio);
      }
      return json(res, 200, {
        id: prediction.id,
        status: prediction.status,
        error: prediction.error || null,
        output: prediction.status === 'succeeded' ? normalizeOutput(prediction.output) : null,
        metrics: prediction.metrics || null
      });
    }
    if (req.method === 'DELETE') {
      const id = String(queryParam(req, 'id') || '').trim();
      if (!/^[a-z0-9_-]{6,80}$/i.test(id)) return json(res, 400, { error: 'Invalid STEM job id.' });
      const prediction = await replicate(`${API}/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      await cleanupInput(prediction?.input?.audio);
      return json(res, 200, { id: prediction.id, status: prediction.status });
    }
    return methodNotAllowed(res, ['GET','POST','DELETE']);
  } catch (error) {
    console.error('REDLINE_STEM_API_ERROR', error?.message || error);
    return json(res, error?.code === 'CONFIG' ? 503 : 502, { error: error?.code === 'CONFIG' ? error.message : 'STEM processing failed.' });
  }
}
