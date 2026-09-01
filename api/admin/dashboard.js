import { requireAdmin } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const [codes, music, global] = await Promise.all([
      query("SELECT status, COUNT(*)::int AS count FROM investor_access_codes GROUP BY status"),
      query('SELECT COUNT(*)::int AS count FROM music_tracks'),
      query('SELECT COUNT(*)::int AS count FROM global_representatives')
    ]);
    return json(res, 200, { codes, musicCount: music[0].count, globalCount: global[0].count });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to load dashboard.' });
  }
}
