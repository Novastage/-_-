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
    const rows = await query('SELECT id, storage_path, content_type, title FROM music_tracks WHERE id = $1 AND is_active = TRUE', [req.query.id]);
    const track = rows[0];
    if (!track) return json(res, 404, { error: 'Track not found.' });
    const blob = await getPrivateFile(track.storage_path);
    if (!blob?.stream) return json(res, 404, { error: 'Private audio file not found.' });
    noStore(res);
    res.setHeader('Content-Type', track.content_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(track.title)}"`);
    await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'MUSIC_STREAM', resourceType: 'MUSIC', resourceId: track.id });
    Readable.fromWeb(blob.stream).pipe(res);
  } catch (error) {
    if (!res.headersSent) return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to stream private audio.' });
    res.end();
  }
}
