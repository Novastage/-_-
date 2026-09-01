import { endInvestorSession, investorSession } from '../../_lib/auth.js';
import { clearCookie, json, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const session = await investorSession(req);
    if (session) await endInvestorSession(session);
    clearCookie(res, 'nova_investor_session');
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to sign out.' });
  }
}
