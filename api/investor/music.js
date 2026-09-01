import { requireInvestor } from '../_lib/auth.js';
import { logAccess, query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    const tracks = await query("SELECT id, title, category, genre, concept, target_artist, description FROM music_tracks WHERE is_active = TRUE ORDER BY category, display_order, created_at DESC");
    await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'MUSIC_LIBRARY_ACCESS' });
    return json(res, 200, { tracks: tracks.map((track) => ({ ...track, streamUrl: `/api/investor/music/${track.id}/stream` })) });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to load music library.' });
  }
}
