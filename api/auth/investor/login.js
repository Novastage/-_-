import { config, requireEnvironment } from '../../_lib/config.js';
import { createAccessCode, expiresAt, hmac, id, randomToken } from '../../_lib/crypto.js';
import { query, logAccess } from '../../_lib/db.js';
import { badRequest, getClientIp, json, methodNotAllowed, setCookie } from '../../_lib/http.js';
import { checkLoginRateLimit } from '../../_lib/rate-limit.js';
import { cookieNames } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    requireEnvironment('DATABASE_URL', 'SESSION_SECRET', 'ACCESS_CODE_PEPPER');
    if (!await checkLoginRateLimit(req, 'investor-login')) return json(res, 429, { error: 'Too many attempts. Please try again later.' });
    const code = String(req.body?.accessCode || '').trim().toUpperCase();
    if (!/^NOVA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return badRequest(res, 'Enter a valid access code.');
    const codeHash = hmac(code, process.env.ACCESS_CODE_PEPPER);
    const rows = await query('SELECT * FROM investor_access_codes WHERE code_hash = $1', [codeHash]);
    const access = rows[0];
    const isExpired = access?.expires_at && new Date(access.expires_at) <= new Date();
    if (!access || access.status !== 'UNUSED' || isExpired) {
      if (access && isExpired) await query("UPDATE investor_access_codes SET status = 'EXPIRED' WHERE id = $1", [access.id]);
      await logAccess({ actorType: 'SYSTEM', eventType: 'INVESTOR_LOGIN_DENIED', metadata: { ip: getClientIp(req) } });
      return json(res, 401, { error: 'This access code is invalid, expired, or already used.' });
    }
    const claimed = await query(
      "UPDATE investor_access_codes SET status = 'ACTIVE_SESSION', first_access_at = COALESCE(first_access_at, NOW()), last_activity_at = NOW() WHERE id = $1 AND status = 'UNUSED' RETURNING id",
      [access.id]
    );
    if (!claimed[0]) return json(res, 409, { error: 'This access code has just been used.' });
    const token = randomToken();
    await query(
      'INSERT INTO investor_sessions (id, access_code_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [id(), access.id, hmac(token, process.env.SESSION_SECRET), expiresAt(config.investorSessionSeconds)]
    );
    setCookie(res, cookieNames.investorCookie, token, config.investorSessionSeconds);
    await logAccess({ actorType: 'INVESTOR', actorId: access.id, eventType: 'INVESTOR_LOGIN_SUCCESS' });
    return json(res, 200, { ok: true, redirect: '/investor/room/' });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: error.code === 'CONFIGURATION_REQUIRED' ? 'Investor Room is not configured yet.' : 'Unable to sign in.' });
  }
}
