import { Readable } from 'node:stream';
import { requireInvestor } from '../../../_lib/auth.js';
import { getPrivateFile } from '../../../_lib/blob.js';
import { logAccess, query } from '../../../_lib/db.js';
import { json, methodNotAllowed, noStore } from '../../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    const rows = await query('SELECT id, profile_pdf_path FROM global_representatives WHERE id = $1 AND is_active = TRUE', [req.query.id]);
    const representative = rows[0];
    if (!representative?.profile_pdf_path) return json(res, 404, { error: 'Profile PDF not found.' });
    const blob = await getPrivateFile(representative.profile_pdf_path);
    if (!blob?.stream) return json(res, 404, { error: 'Private profile PDF not found.' });
    noStore(res);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="nova-stage-global-profile.pdf"');
    await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'PROFILE_PDF_VIEW', resourceType: 'GLOBAL_REP', resourceId: representative.id });
    Readable.fromWeb(blob.stream).pipe(res);
  } catch (error) {
    if (!res.headersSent) return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to open private PDF.' });
    res.end();
  }
}
