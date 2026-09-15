import { issueSignedToken, presignUrl } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { json, methodNotAllowed } from '../_lib/http.js';

const AUDIO_TYPES = [
  'audio/wav','audio/x-wav','audio/wave','audio/mpeg','audio/mp3','audio/flac',
  'audio/x-flac','audio/aiff','audio/x-aiff','audio/mp4','audio/aac','audio/ogg',
  'application/octet-stream'
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
  const p = String(pathname || '');
  return p.startsWith('redline/stem-input/') && !p.includes('..') && p.length <= 240;
}
function validContentType(value) {
  const type = String(value || 'application/octet-stream').toLowerCase();
  return AUDIO_TYPES.includes(type) ? type : 'application/octet-stream';
}
function bareBlobUrl(presignedUrl) {
  const u = new URL(presignedUrl);
  u.search = '';
  u.hash = '';
  return u.toString();
}

async function createDirectUpload(body) {
  const pathname = String(body?.pathname || '');
  const size = Number(body?.size || 0);
  if (!validPath(pathname)) throw new Error('Invalid STEM upload path.');
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) throw new Error('Invalid STEM upload size.');

  const validUntil = Date.now() + 15 * 60 * 1000;
  const signedToken = await issueSignedToken({
    pathname,
    operations: ['put'],
    validUntil,
    token: blobToken()
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    operation: 'put',
    pathname,
    access: 'private',
    validUntil
  });

  return {
    pathname,
    uploadUrl: presignedUrl,
    blobUrl: bareBlobUrl(presignedUrl),
    contentType: validContentType(body?.contentType),
    expiresAt: validUntil
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!enabled()) return json(res, 503, { error: 'STEM engine is not enabled yet.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    if (body?.action === 'presign') {
      const result = await createDirectUpload(body);
      return json(res, 200, result);
    }

    if (['blob.generate-client-token','blob.upload-completed'].includes(body?.type)) {
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
    }

    return json(res, 400, { error: 'Invalid upload request.' });
  } catch (error) {
    console.error('REDLINE_STEM_UPLOAD_ERROR', error?.message || error);
    const message = String(error?.message || '');
    if (message.includes('size')) return json(res, 413, { error: 'STEM 파일은 최대 80MB까지 업로드할 수 있습니다.' });
    return json(res, 400, { error: 'Unable to authorize STEM upload.' });
  }
}
