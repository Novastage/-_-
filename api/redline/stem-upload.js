import { handleUpload } from '@vercel/blob/client';
import { json, methodNotAllowed } from '../_lib/http.js';

const AUDIO_TYPES = [
  'audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/mp3','audio/flac',
  'audio/x-flac','audio/aiff','audio/x-aiff','audio/mp4','audio/aac','audio/ogg'
];
const MAX_BYTES = 80 * 1024 * 1024;
const CALLBACK_URL = 'https://www.nsenter.co.kr/api/redline/stem-upload';

function enabled() {
  return String(process.env.REDLINE_STEM_ENABLED || '').toLowerCase() === 'true';
}
function blobToken() {
  const value = String(process.env.REDLINE_STEM_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!value) throw new Error('RED LINE STEM Blob token is not configured.');
  return value;
}
function validPath(pathname) {
  return String(pathname || '').startsWith('redline/stem-input/') && !String(pathname).includes('..');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!enabled()) return json(res, 503, { error: 'STEM engine is not enabled yet.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!['blob.generate-client-token','blob.upload-completed'].includes(body?.type)) {
      return json(res, 400, { error: 'Invalid upload event.' });
    }
    const result = await handleUpload({
      body,
      request: req,
      token: blobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!validPath(pathname)) throw new Error('Invalid STEM upload path.');
        return {
          allowedContentTypes: AUDIO_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 15 * 60 * 1000,
          callbackUrl: CALLBACK_URL,
          tokenPayload: JSON.stringify({ kind: 'redline-stem-input' })
        };
      },
      onUploadCompleted: async ({ blob }) => {
        if (!validPath(blob.pathname)) throw new Error('Invalid STEM upload completion path.');
      }
    });
    return json(res, 200, result);
  } catch (error) {
    console.error('REDLINE_STEM_UPLOAD_ERROR', error?.message || error);
    return json(res, 400, { error: 'Unable to authorize STEM upload.' });
  }
}
