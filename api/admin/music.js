import { requireAdmin } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const tracks = await query('SELECT id, title, category, genre, concept, target_artist, description, content_type, display_order, is_active, created_at FROM music_tracks ORDER BY category, display_order, created_at DESC');
    return json(res, 200, { tracks });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to load music.' });
  }
}
