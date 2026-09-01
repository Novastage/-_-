import { requireInvestor } from '../../_lib/auth.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    return json(res, 200, { investor: { label: session.investor_label, company: session.company }, expiresAt: session.session_expires_at });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to verify investor session.' });
  }
}
