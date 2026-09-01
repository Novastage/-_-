import { requireAdmin } from '../../_lib/auth.js';
import { logAccess, query } from '../../_lib/db.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.body?.action !== 'revoke') return json(res, 400, { error: 'Unsupported action.' });
    const updated = await query("UPDATE investor_access_codes SET status = 'REVOKED' WHERE id = $1 AND status IN ('UNUSED', 'ACTIVE_SESSION') RETURNING id", [req.query.id]);
    if (!updated[0]) return json(res, 404, { error: 'Active access code not found.' });
    await query('UPDATE investor_sessions SET revoked_at = NOW() WHERE access_code_id = $1 AND revoked_at IS NULL', [req.query.id]);
    await logAccess({ actorType: 'ADMIN', actorId: admin.admin_user_id, eventType: 'ACCESS_CODE_REVOKED', resourceType: 'ACCESS_CODE', resourceId: req.query.id });
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to revoke access code.' });
  }
}
