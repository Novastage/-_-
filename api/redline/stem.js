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
function validBlobUrl(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com') && u.pathname.includes('redline');
  } catch { return false; }
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
      const prediction = await replicate(API, {
        method: 'POST',
        body: JSON.stringify({
          version: VERSION,
          input: {
            audio: body.audioUrl,
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
      return json(res, 200, { id: prediction.id, status: prediction.status });
    }
    return methodNotAllowed(res, ['GET','POST','DELETE']);
  } catch (error) {
    console.error('REDLINE_STEM_API_ERROR', error?.message || error);
    return json(res, error?.code === 'CONFIG' ? 503 : 502, { error: error?.code === 'CONFIG' ? error.message : 'STEM processing failed.' });
  }
}
