import { head } from '@vercel/blob';
import { requireAdmin } from '../_lib/auth.js';
import { config, requireEnvironment } from '../_lib/config.js';
import { id } from '../_lib/crypto.js';
import { logAccess, query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';
import { normalizeTrackSlug } from '../_lib/slug.js';

const audioTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave']);
const cleanText = (value, maximum = 500) => String(value || '').trim().slice(0, maximum);

function readTrack(body = {}) {
  const title = cleanText(body.title, 160);
  const slug = normalizeTrackSlug(body.slug, { required: true });
  const category = cleanText(body.category, 16).toUpperCase();
  if (!title || !['MALE', 'FEMALE'].includes(category)) {
    throw Object.assign(new Error('Music title and category are required.'), { code: 'INVALID_TRACK' });
  }
  return {
    title,
    slug,
    category,
    genre: cleanText(body.genre, 80),
    concept: cleanText(body.concept, 160),
    targetArtist: cleanText(body.targetArtist, 160),
    description: cleanText(body.description, 1200),
    displayOrder: Number.parseInt(body.displayOrder, 10) || 0
  };
}

function validMusicPath(pathname) {
  const value = String(pathname || '');
  return value.startsWith('investor-room/music/') && !value.includes('..');
}

async function bySlug(slug) {
  const rows = await query('SELECT id, title, slug, storage_path, content_type, is_active FROM music_tracks WHERE slug = $1 LIMIT 1', [slug]);
  return rows[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    requireEnvironment('DATABASE_URL', 'BLOB_READ_WRITE_TOKEN');

    const body = req.body || {};
    const action = String(body.action || 'finalize');
    const track = readTrack(body);

    if (action === 'preflight') {
      const existing = await bySlug(track.slug);
      if (existing) {
        return json(res, 409, { error: `The slug “${track.slug}” is already in the music library. Use Replace file for an existing track or choose a new slug.` });
      }
      return json(res, 200, { ok: true });
    }

    if (action !== 'finalize') return json(res, 400, { error: 'Invalid music upload action.' });

    const pathname = String(body.pathname || '');
    if (!validMusicPath(pathname)) return json(res, 400, { error: 'Invalid private music path.' });

    const blob = await head(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const contentType = cleanText(blob?.contentType || body.contentType, 100).toLowerCase();
    const size = Number(blob?.size || 0);
    if (!audioTypes.has(contentType)) return json(res, 400, { error: 'The uploaded Blob is not a supported audio file.' });
    if (Number.isFinite(size) && size > config.maxAudioBytes) return json(res, 413, { error: 'The uploaded audio file is too large.' });

    // The normal Blob completion webhook may win this race. If it already
    // registered this exact upload, treat that as success instead of duplicating it.
    let existing = await bySlug(track.slug);
    if (existing) {
      if (existing.storage_path === pathname) return json(res, 200, { ok: true, trackId: existing.id, alreadyRegistered: true });
      return json(res, 409, { error: `The slug “${track.slug}” is already in use by another track.` });
    }

    const trackId = id();
    const inserted = await query(
      'INSERT INTO music_tracks (id, title, slug, category, genre, concept, target_artist, description, storage_path, content_type, display_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING RETURNING id',
      [trackId, track.title, track.slug, track.category, track.genre || null, track.concept || null, track.targetArtist || null, track.description || null, pathname, contentType, track.displayOrder]
    );

    if (!inserted[0]) {
      existing = await bySlug(track.slug);
      if (existing?.storage_path === pathname) return json(res, 200, { ok: true, trackId: existing.id, alreadyRegistered: true });
      return json(res, 409, { error: `The slug “${track.slug}” became unavailable while the upload was finishing.` });
    }

    await logAccess({
      actorType: 'ADMIN',
      actorId: admin.admin_user_id,
      eventType: 'MUSIC_UPLOAD_FINALIZED',
      resourceType: 'MUSIC',
      resourceId: trackId,
      metadata: { pathname }
    });

    return json(res, 200, { ok: true, trackId });
  } catch (error) {
    if (error.code === 'INVALID_SLUG' || error.code === 'INVALID_TRACK') return json(res, 400, { error: error.message });
    if (error.code === '23505') return json(res, 409, { error: 'That music slug is already in use.' });
    console.error('NOVA_MUSIC_FINALIZE_FAILURE', error?.message || error);
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'The file upload finished, but music library registration failed.' });
  }
}
