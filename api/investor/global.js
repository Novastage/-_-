import { requireInvestor } from '../_lib/auth.js';
import { logAccess, query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    const representatives = await query('SELECT id, country, name, position, role, short_bio, profile_photo_path FROM global_representatives WHERE is_active = TRUE ORDER BY display_order, country');
    await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'GLOBAL_REP_ACCESS' });
    return json(res, 200, { representatives: representatives.map((rep) => ({ ...rep, profilePdfUrl: `/api/investor/global/${rep.id}/profile`, profilePhotoUrl: rep.profile_photo_path ? `/api/investor/global/${rep.id}/photo` : null, profile_photo_path: undefined })) });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to load global representatives.' });
  }
}
