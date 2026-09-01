import { requireAdmin } from '../_lib/auth.js';
import { removePrivateFile } from '../_lib/blob.js';
import { logAccess, query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.method === 'GET') {
      const representatives = await query('SELECT id, country, name, position, role, short_bio, display_order, is_active, profile_pdf_path IS NOT NULL AS has_profile_pdf, profile_photo_path IS NOT NULL AS has_profile_photo FROM global_representatives ORDER BY display_order, country');
      return json(res, 200, { representatives });
    }
    const representativeId = String(req.query?.id || '');
    if (!representativeId) return json(res, 400, { error: 'Representative id is required.' });
    if (req.method === 'PATCH') {
      const body = req.body || {};
      const updated = await query('UPDATE global_representatives SET country = COALESCE($2, country), name = COALESCE($3, name), position = COALESCE($4, position), role = COALESCE($5, role), short_bio = COALESCE($6, short_bio), display_order = COALESCE($7, display_order), is_active = COALESCE($8, is_active), updated_at = NOW() WHERE id = $1 RETURNING id', [representativeId, body.country ?? null, body.name ?? null, body.position ?? null, body.role ?? null, body.shortBio ?? null, Number.isInteger(body.displayOrder) ? body.displayOrder : null, typeof body.isActive === 'boolean' ? body.isActive : null]);
      if (!updated[0]) return json(res, 404, { error: 'Representative not found.' });
      await logAccess({ actorType: 'ADMIN', actorId: admin.admin_user_id, eventType: 'GLOBAL_REP_UPDATED', resourceType: 'GLOBAL_REP', resourceId: representativeId });
      return json(res, 200, { ok: true });
    }
    if (req.method !== 'DELETE') return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
    const rows = await query('DELETE FROM global_representatives WHERE id = $1 RETURNING profile_photo_path, profile_pdf_path', [representativeId]);
    if (!rows[0]) return json(res, 404, { error: 'Representative not found.' });
    await Promise.all([removePrivateFile(rows[0].profile_photo_path), removePrivateFile(rows[0].profile_pdf_path)]);
    await logAccess({ actorType: 'ADMIN', actorId: admin.admin_user_id, eventType: 'GLOBAL_REP_DELETED', resourceType: 'GLOBAL_REP', resourceId: representativeId });
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to manage global representatives.' });
  }
}
