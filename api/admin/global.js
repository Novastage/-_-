import { requireAdmin } from '../_lib/auth.js';
import { query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const representatives = await query('SELECT id, country, name, position, role, short_bio, display_order, is_active, profile_pdf_path IS NOT NULL AS has_profile_pdf, profile_photo_path IS NOT NULL AS has_profile_photo FROM global_representatives ORDER BY display_order, country');
    return json(res, 200, { representatives });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to load global representatives.' });
  }
}
