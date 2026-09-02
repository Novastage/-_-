import { config, requireEnvironment } from './config.js';
import { hmac } from './crypto.js';
import { query, logAccess } from './db.js';
import { cookie, json } from './http.js';

const investorCookie = 'nova_investor_session';
const adminCookie = 'nova_admin_session';

export async function investorSession(req) {
  requireEnvironment('DATABASE_URL', 'SESSION_SECRET', 'ACCESS_CODE_PEPPER');
  const token = cookie(req, investorCookie);
  if (!token) return null;
  const tokenHash = hmac(token, process.env.SESSION_SECRET);
  const rows = await query(
    `SELECT s.id AS session_id, s.access_code_id, s.expires_at AS session_expires_at,
            c.investor_label, c.company, c.access_type, c.status, c.expires_at AS code_expires_at
       FROM investor_sessions s
       JOIN investor_access_codes c ON c.id = s.access_code_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL`,
    [tokenHash]
  );
  const session = rows[0];
  if (!session) return null;
  const reusable = session.access_type === 'VALID_UNTIL';
  const codeExpired = session.code_expires_at && new Date(session.code_expires_at) <= new Date();
  const invalidStatus = reusable ? session.status !== 'UNUSED' : session.status !== 'ACTIVE_SESSION';
  const expired = new Date(session.session_expires_at) <= new Date() || codeExpired || invalidStatus;
  if (expired) {
    await query('UPDATE investor_sessions SET revoked_at = NOW() WHERE id = $1', [session.session_id]);
    if (!reusable) await query("UPDATE investor_access_codes SET status = CASE WHEN status = 'REVOKED' THEN status ELSE 'USED' END WHERE id = $1", [session.access_code_id]);
    if (reusable && codeExpired) await query("UPDATE investor_access_codes SET status = CASE WHEN status = 'REVOKED' THEN status ELSE 'EXPIRED' END WHERE id = $1", [session.access_code_id]);
    return null;
  }
  await query('UPDATE investor_sessions SET last_activity_at = NOW() WHERE id = $1', [session.session_id]);
  await query('UPDATE investor_access_codes SET last_activity_at = NOW() WHERE id = $1', [session.access_code_id]);
  return session;
}

export async function requireInvestor(req, res) {
  const session = await investorSession(req);
  if (!session) {
    json(res, 401, { error: 'Investor authentication is required.' });
    return null;
  }
  return session;
}

export async function endInvestorSession(session, eventType = 'INVESTOR_LOGOUT') {
  await query('UPDATE investor_sessions SET revoked_at = NOW() WHERE id = $1', [session.session_id]);
  await query("UPDATE investor_access_codes SET status = 'USED' WHERE id = $1 AND access_type = 'ONE_TIME' AND status = 'ACTIVE_SESSION'", [session.access_code_id]);
  await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType });
}

export async function adminSession(req) {
  requireEnvironment('DATABASE_URL', 'ADMIN_SESSION_SECRET');
  const token = cookie(req, adminCookie);
  if (!token) return null;
  const tokenHash = hmac(token, process.env.ADMIN_SESSION_SECRET);
  const rows = await query(
    `SELECT s.id AS session_id, s.admin_user_id, s.expires_at, u.email
       FROM admin_sessions s JOIN admin_users u ON u.id = s.admin_user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND u.is_active = TRUE`,
    [tokenHash]
  );
  const session = rows[0];
  if (!session || new Date(session.expires_at) <= new Date()) {
    if (session) await query('UPDATE admin_sessions SET revoked_at = NOW() WHERE id = $1', [session.session_id]);
    return null;
  }
  await query('UPDATE admin_sessions SET last_activity_at = NOW() WHERE id = $1', [session.session_id]);
  return session;
}

export async function requireAdmin(req, res) {
  const session = await adminSession(req);
  if (!session) {
    json(res, 401, { error: 'Admin authentication is required.' });
    return null;
  }
  return session;
}

export async function endAdminSession(session) {
  await query('UPDATE admin_sessions SET revoked_at = NOW() WHERE id = $1', [session.session_id]);
  await logAccess({ actorType: 'ADMIN', actorId: session.admin_user_id, eventType: 'ADMIN_LOGOUT' });
}

export const cookieNames = { investorCookie, adminCookie };
export const sessionConfig = config;
