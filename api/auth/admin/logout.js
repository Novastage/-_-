import { adminSession, endAdminSession } from '../../_lib/auth.js';
import { clearCookie, json, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const session = await adminSession(req);
    if (session) await endAdminSession(session);
    clearCookie(res, 'nova_admin_session');
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 500, { error: 'Unable to sign out.' });
  }
}
