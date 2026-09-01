import { config, requireEnvironment } from '../../_lib/config.js';
import { cookieNames } from '../../_lib/auth.js';
import { expiresAt, hmac, id, randomToken, verifyPassword } from '../../_lib/crypto.js';
import { query, logAccess } from '../../_lib/db.js';
import { badRequest, json, methodNotAllowed, setCookie } from '../../_lib/http.js';
import { checkLoginRateLimit } from '../../_lib/rate-limit.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    requireEnvironment('DATABASE_URL', 'ADMIN_SESSION_SECRET', 'ACCESS_CODE_PEPPER');
    if (!await checkLoginRateLimit(req, 'admin-login')) return json(res, 429, { error: 'Too many attempts. Please try again later.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return badRequest(res, 'Email and password are required.');
    const rows = await query('SELECT * FROM admin_users WHERE email = $1 AND is_active = TRUE', [email]);
    const admin = rows[0];
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      await logAccess({ actorType: 'SYSTEM', eventType: 'ADMIN_LOGIN_DENIED' });
      return json(res, 401, { error: 'Invalid email or password.' });
    }
    const token = randomToken();
    await query('INSERT INTO admin_sessions (id, admin_user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [id(), admin.id, hmac(token, process.env.ADMIN_SESSION_SECRET), expiresAt(config.adminSessionSeconds)]);
    await query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [admin.id]);
    setCookie(res, cookieNames.adminCookie, token, config.adminSessionSeconds);
    await logAccess({ actorType: 'ADMIN', actorId: admin.id, eventType: 'ADMIN_LOGIN_SUCCESS' });
    return json(res, 200, { ok: true, redirect: '/admin/' });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: error.code === 'CONFIGURATION_REQUIRED' ? 'Admin service is not configured yet.' : 'Unable to sign in.' });
  }
}
