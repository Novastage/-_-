import { Readable } from 'node:stream';
import { requireInvestor } from '../../../_lib/auth.js';
import { getPrivateFile } from '../../../_lib/blob.js';
import { query } from '../../../_lib/db.js';
import { json, methodNotAllowed, noStore } from '../../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    const rows = await query('SELECT profile_photo_path FROM global_representatives WHERE id = $1 AND is_active = TRUE', [req.query.id]);
    if (!rows[0]?.profile_photo_path) return json(res, 404, { error: 'Profile photo not found.' });
    const blob = await getPrivateFile(rows[0].profile_photo_path);
    if (!blob?.stream) return json(res, 404, { error: 'Private profile photo not found.' });
    noStore(res);
    res.setHeader('Content-Type', blob.blob?.contentType || 'image/jpeg');
    Readable.fromWeb(blob.stream).pipe(res);
  } catch (error) {
    if (!res.headersSent) return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to open profile photo.' });
    res.end();
  }
}
