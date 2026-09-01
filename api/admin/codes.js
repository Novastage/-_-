import { requireAdmin } from '../_lib/auth.js';
import { createAccessCode, hmac, id } from '../_lib/crypto.js';
import { logAccess, query } from '../_lib/db.js';
import { badRequest, json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.method === 'GET') {
      const [codes, statusCounts, music, global] = await Promise.all([
        query('SELECT id, investor_label, company, memo, status, expires_at, first_access_at, last_activity_at, created_at FROM investor_access_codes ORDER BY created_at DESC LIMIT 200'),
        query("SELECT status, COUNT(*)::int AS count FROM investor_access_codes GROUP BY status"),
        query('SELECT COUNT(*)::int AS count FROM music_tracks'),
        query('SELECT COUNT(*)::int AS count FROM global_representatives')
      ]);
      return json(res, 200, { codes, dashboard: { codes: statusCounts, musicCount: music[0].count, globalCount: global[0].count } });
    }
    if (req.method === 'POST') {
      const investorLabel = String(req.body?.investorLabel || '').trim();
      const company = String(req.body?.company || '').trim() || null;
      const memo = String(req.body?.memo || '').trim() || null;
      const expiryDate = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
      if (expiryDate && Number.isNaN(expiryDate.getTime())) return badRequest(res, 'Enter a valid expiration date.');
      if (!investorLabel) return badRequest(res, 'Investor name is required.');
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const rawCode = createAccessCode();
        try {
          const codeId = id();
          await query('INSERT INTO investor_access_codes (id, code_hash, investor_label, company, memo, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)', [codeId, hmac(rawCode, process.env.ACCESS_CODE_PEPPER), investorLabel, company, memo, expiryDate ? expiryDate.toISOString() : null, admin.admin_user_id]);
          await logAccess({ actorType: 'ADMIN', actorId: admin.admin_user_id, eventType: 'ACCESS_CODE_CREATED', resourceType: 'ACCESS_CODE', resourceId: codeId });
          return json(res, 201, { code: { id: codeId, value: rawCode, investorLabel, expiresAt: expiryDate ? expiryDate.toISOString() : null } });
        } catch (error) { if (error?.code !== '23505') throw error; }
      }
      return json(res, 500, { error: 'Unable to create a unique access code.' });
    }
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['GET', 'POST', 'PATCH']);
    const codeId = String(req.query?.id || '');
    if (req.body?.action !== 'revoke' || !codeId) return json(res, 400, { error: 'Unsupported action.' });
    const updated = await query("UPDATE investor_access_codes SET status = 'REVOKED' WHERE id = $1 AND status IN ('UNUSED', 'ACTIVE_SESSION') RETURNING id", [codeId]);
    if (!updated[0]) return json(res, 404, { error: 'Active access code not found.' });
    await query('UPDATE investor_sessions SET revoked_at = NOW() WHERE access_code_id = $1 AND revoked_at IS NULL', [codeId]);
    await logAccess({ actorType: 'ADMIN', actorId: admin.admin_user_id, eventType: 'ACCESS_CODE_REVOKED', resourceType: 'ACCESS_CODE', resourceId: codeId });
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to manage access codes.' });
  }
}
