import { adminSession, cookieNames, endAdminSession, endInvestorSession, investorSession, requireAdmin, requireInvestor } from './_lib/auth.js';
import { config, requireEnvironment } from './_lib/config.js';
import { expiresAt, hmac, id, randomToken, verifyPassword } from './_lib/crypto.js';
import { logAccess, query } from './_lib/db.js';
import { badRequest, clearCookie, getClientIp, json, methodNotAllowed, setCookie } from './_lib/http.js';
import { checkLoginRateLimit } from './_lib/rate-limit.js';

async function investorLogin(req, res) {
  requireEnvironment('DATABASE_URL', 'SESSION_SECRET', 'ACCESS_CODE_PEPPER');
  if (!await checkLoginRateLimit(req, 'investor-login')) return json(res, 429, { error: 'Too many attempts. Please try again later.' });
  const code = String(req.body?.accessCode || '').trim().toUpperCase();
  if (!/^NOVA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return badRequest(res, 'Enter a valid access code.');
  const rows = await query('SELECT * FROM investor_access_codes WHERE code_hash = $1', [hmac(code, process.env.ACCESS_CODE_PEPPER)]);
  const access = rows[0];
  const isExpired = access?.expires_at && new Date(access.expires_at) <= new Date();
  if (!access || access.status !== 'UNUSED' || isExpired) {
    if (access && isExpired) await query("UPDATE investor_access_codes SET status = 'EXPIRED' WHERE id = $1", [access.id]);
    await logAccess({ actorType: 'SYSTEM', eventType: 'INVESTOR_LOGIN_DENIED', metadata: { ip: getClientIp(req) } });
    return json(res, 401, { error: 'This access code is invalid, expired, or already used.' });
  }
  const claimed = await query("UPDATE investor_access_codes SET status = 'ACTIVE_SESSION', first_access_at = COALESCE(first_access_at, NOW()), last_activity_at = NOW() WHERE id = $1 AND status = 'UNUSED' RETURNING id", [access.id]);
  if (!claimed[0]) return json(res, 409, { error: 'This access code has just been used.' });
  const token = randomToken();
  await query('INSERT INTO investor_sessions (id, access_code_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)', [id(), access.id, hmac(token, process.env.SESSION_SECRET), expiresAt(config.investorSessionSeconds)]);
  setCookie(res, cookieNames.investorCookie, token, config.investorSessionSeconds);
  await logAccess({ actorType: 'INVESTOR', actorId: access.id, eventType: 'INVESTOR_LOGIN_SUCCESS' });
  return json(res, 200, { ok: true, redirect: '/investor/room/' });
}

async function adminLogin(req, res) {
  requireEnvironment('DATABASE_URL', 'ADMIN_SESSION_SECRET', 'ACCESS_CODE_PEPPER');
  if (!await checkLoginRateLimit(req, 'admin-login')) return json(res, 429, { error: 'Too many attempts. Please try again later.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return badRequest(res, 'Email and password are required.');
  const admin = (await query('SELECT * FROM admin_users WHERE email = $1 AND is_active = TRUE', [email]))[0];
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
}

export default async function handler(req, res) {
  const role = String(req.query?.role || '');
  const action = String(req.query?.action || '');
  try {
    if (!['investor', 'admin'].includes(role) || !['login', 'logout', 'session'].includes(action)) return json(res, 404, { error: 'Authentication endpoint not found.' });
    if (action === 'login') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      return role === 'investor' ? investorLogin(req, res) : adminLogin(req, res);
    }
    if (action === 'logout') {
      if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
      const session = role === 'investor' ? await investorSession(req) : await adminSession(req);
      if (session) await (role === 'investor' ? endInvestorSession(session) : endAdminSession(session));
      clearCookie(res, role === 'investor' ? cookieNames.investorCookie : cookieNames.adminCookie);
      return json(res, 200, { ok: true });
    }
    if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
    const session = role === 'investor' ? await requireInvestor(req, res) : await requireAdmin(req, res);
    if (!session) return;
    return role === 'investor'
      ? json(res, 200, { investor: { label: session.investor_label, company: session.company }, expiresAt: session.session_expires_at })
      : json(res, 200, { admin: { email: session.email }, expiresAt: session.expires_at });
  } catch (error) {
    const serviceError = role === 'admin' ? 'Admin service is not configured yet.' : 'Investor Room is not configured yet.';
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: error.code === 'CONFIGURATION_REQUIRED' ? serviceError : 'Unable to complete authentication.' });
  }
}
