import { requireInvestor } from '../_lib/auth.js';
import { logAccess, query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    const [music] = await query('SELECT COUNT(*)::int AS count FROM music_tracks WHERE is_active = TRUE');
    const [global] = await query('SELECT COUNT(*)::int AS count FROM global_representatives WHERE is_active = TRUE');
    await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'INVESTOR_OVERVIEW_ACCESS' });
    return json(res, 200, { investor: { label: session.investor_label, company: session.company }, counts: { music: music.count, global: global.count } });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to load investor overview.' });
  }
}
