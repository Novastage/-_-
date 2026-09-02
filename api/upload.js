import { handleUpload } from '@vercel/blob/client';
import { requireAdmin } from './_lib/auth.js';
import { removePrivateFile } from './_lib/blob.js';
import { config, requireEnvironment } from './_lib/config.js';
import { id } from './_lib/crypto.js';
import { logAccess, query } from './_lib/db.js';
import { json, methodNotAllowed } from './_lib/http.js';
import { normalizeTrackSlug } from './_lib/slug.js';

const audioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'];
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value));
const cleanText = (value, maximum = 500) => String(value || '').trim().slice(0, maximum);
const isMusic = (kind) => kind === 'music' || kind === 'music-replace';
const isPdf = (kind) => kind === 'global-pdf' || kind === 'global-pdf-replace';
const isReplacement = (kind) => kind.endsWith('-replace');

function readIntent(payload) {
  let intent;
  try { intent = JSON.parse(payload || '{}'); } catch { throw new Error('Invalid upload request.'); }
  if (!['music', 'music-replace', 'global-pdf', 'global-pdf-replace', 'global-photo', 'global-photo-replace'].includes(intent.kind)) throw new Error('Unsupported upload type.');
  if (isMusic(intent.kind)) {
    if (isReplacement(intent.kind) && !isUuid(intent.targetId)) throw new Error('Invalid music replacement request.');
    const title = cleanText(intent.title, 160);
    const category = cleanText(intent.category, 16).toUpperCase();
    const slug = normalizeTrackSlug(intent.slug, { required: !isReplacement(intent.kind) });
    if (!isReplacement(intent.kind) && (!title || !['MALE', 'FEMALE'].includes(category))) throw new Error('Music title and category are required.');
    return { kind: intent.kind, targetId: intent.targetId || null, issuedId: isUuid(intent.issuedId) ? intent.issuedId : null, title, slug, category, genre: cleanText(intent.genre, 80), concept: cleanText(intent.concept, 160), targetArtist: cleanText(intent.targetArtist, 160), description: cleanText(intent.description, 1200), displayOrder: Number.parseInt(intent.displayOrder, 10) || 0, adminUserId: isUuid(intent.adminUserId) ? intent.adminUserId : null };
  }
  if (isReplacement(intent.kind) && !isUuid(intent.targetId)) throw new Error('Invalid global file replacement request.');
  if (!isReplacement(intent.kind) && !isUuid(intent.globalId)) throw new Error('Invalid global representative request.');
  return { kind: intent.kind, targetId: intent.targetId || null, issuedId: isUuid(intent.issuedId) ? intent.issuedId : null, globalId: intent.globalId || null, country: cleanText(intent.country, 100), name: cleanText(intent.name, 160), position: cleanText(intent.position, 160), role: cleanText(intent.role, 160), shortBio: cleanText(intent.shortBio, 1200), displayOrder: Number.parseInt(intent.displayOrder, 10) || 0, adminUserId: isUuid(intent.adminUserId) ? intent.adminUserId : null };
}

function validatePath(pathname, kind) {
  const prefix = isMusic(kind) ? 'investor-room/music/' : isPdf(kind) ? 'investor-room/global-profiles/' : 'investor-room/global-photos/';
  if (!String(pathname).startsWith(prefix) || pathname.includes('..')) throw new Error('Invalid private storage path.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    requireEnvironment('DATABASE_URL', 'BLOB_READ_WRITE_TOKEN');
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (body?.type !== 'blob.generate-client-token' && body?.type !== 'blob.upload-completed') return json(res, 400, { error: 'Invalid upload event.' });
    let administrator = null;
    if (body.type === 'blob.generate-client-token') {
      administrator = await requireAdmin(req, res);
      if (!administrator) return;
    }
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const intent = readIntent(clientPayload);
        validatePath(pathname, intent.kind);
        if (!isReplacement(intent.kind) && !isMusic(intent.kind) && !intent.country) throw new Error('Country is required.');
        if (isReplacement(intent.kind)) {
          const table = isMusic(intent.kind) ? 'music_tracks' : 'global_representatives';
          const existing = await query(`SELECT id FROM ${table} WHERE id = $1`, [intent.targetId]);
          if (!existing[0]) throw new Error('Requested private file owner was not found.');
        }
        const allowedContentTypes = isMusic(intent.kind) ? audioTypes : isPdf(intent.kind) ? ['application/pdf'] : imageTypes;
        return { allowedContentTypes, maximumSizeInBytes: isMusic(intent.kind) ? config.maxAudioBytes : config.maxPdfBytes, addRandomSuffix: true, validUntil: Date.now() + (15 * 60 * 1000), tokenPayload: JSON.stringify({ ...intent, adminUserId: administrator.admin_user_id, issuedId: id() }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const intent = readIntent(tokenPayload);
        validatePath(blob.pathname, intent.kind);
        if (intent.kind === 'music') {
          if (!intent.issuedId) throw new Error('Missing secure upload identifier.');
          await query('INSERT INTO music_tracks (id, title, slug, category, genre, concept, target_artist, description, storage_path, content_type, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING', [intent.issuedId, intent.title, intent.slug, intent.category, intent.genre || null, intent.concept || null, intent.targetArtist || null, intent.description || null, blob.pathname, blob.contentType, intent.displayOrder]);
          await logAccess({ actorType: 'ADMIN', actorId: intent.adminUserId, eventType: 'MUSIC_UPLOADED', resourceType: 'MUSIC', resourceId: blob.pathname });
          return;
        }
        if (intent.kind === 'music-replace') {
          const previous = await query('SELECT storage_path FROM music_tracks WHERE id = $1', [intent.targetId]);
          const updated = await query('UPDATE music_tracks SET storage_path = $2, content_type = $3, updated_at = NOW() WHERE id = $1 RETURNING id', [intent.targetId, blob.pathname, blob.contentType]);
          if (!updated[0]) throw new Error('Music track no longer exists.');
          if (previous[0]?.storage_path && previous[0].storage_path !== blob.pathname) await removePrivateFile(previous[0].storage_path);
          await logAccess({ actorType: 'ADMIN', actorId: intent.adminUserId, eventType: 'MUSIC_FILE_REPLACED', resourceType: 'MUSIC', resourceId: intent.targetId });
          return;
        }
        if (intent.kind === 'global-pdf-replace' || intent.kind === 'global-photo-replace') {
          const column = isPdf(intent.kind) ? 'profile_pdf_path' : 'profile_photo_path';
          const previous = await query(`SELECT ${column} AS storage_path FROM global_representatives WHERE id = $1`, [intent.targetId]);
          const updated = await query(`UPDATE global_representatives SET ${column} = $2, is_active = CASE WHEN $3 THEN TRUE ELSE is_active END, updated_at = NOW() WHERE id = $1 RETURNING id`, [intent.targetId, blob.pathname, isPdf(intent.kind)]);
          if (!updated[0]) throw new Error('Global representative no longer exists.');
          if (previous[0]?.storage_path && previous[0].storage_path !== blob.pathname) await removePrivateFile(previous[0].storage_path);
          await logAccess({ actorType: 'ADMIN', actorId: intent.adminUserId, eventType: isPdf(intent.kind) ? 'GLOBAL_PROFILE_REPLACED' : 'GLOBAL_PHOTO_REPLACED', resourceType: 'GLOBAL_REP', resourceId: intent.targetId });
          return;
        }
        const profilePdf = isPdf(intent.kind);
        await query(`INSERT INTO global_representatives (id, country, name, position, role, short_bio, profile_photo_path, profile_pdf_path, is_active, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET country = EXCLUDED.country, name = EXCLUDED.name, position = EXCLUDED.position, role = EXCLUDED.role, short_bio = EXCLUDED.short_bio, profile_photo_path = COALESCE(EXCLUDED.profile_photo_path, global_representatives.profile_photo_path), profile_pdf_path = COALESCE(EXCLUDED.profile_pdf_path, global_representatives.profile_pdf_path), is_active = (COALESCE(EXCLUDED.profile_pdf_path, global_representatives.profile_pdf_path) IS NOT NULL), display_order = EXCLUDED.display_order, updated_at = NOW()`, [intent.globalId, intent.country, intent.name || null, intent.position || null, intent.role || null, intent.shortBio || null, profilePdf ? null : blob.pathname, profilePdf ? blob.pathname : null, profilePdf, intent.displayOrder]);
        await logAccess({ actorType: 'ADMIN', actorId: intent.adminUserId, eventType: profilePdf ? 'GLOBAL_PROFILE_UPLOADED' : 'GLOBAL_PHOTO_UPLOADED', resourceType: 'GLOBAL_REP', resourceId: intent.globalId });
      }
    });
    return json(res, 200, result);
  } catch (error) {
    if (error.code === '23505') return json(res, 409, { error: 'That music slug is already in use.' });
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 400, { error: error.message || 'Unable to authorize private upload.' });
  }
}
