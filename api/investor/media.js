import { Readable } from 'node:stream';
import { requireInvestor } from '../_lib/auth.js';
import { getPrivateFile } from '../_lib/blob.js';
import { logAccess, query } from '../_lib/db.js';
import { json, methodNotAllowed, noStore } from '../_lib/http.js';

function streamPrivateBlob(res, blob, contentType, contentDisposition) {
  noStore(res);
  res.setHeader('Content-Type', contentType);
  if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
  Readable.fromWeb(blob.stream).pipe(res);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    const type = String(req.query?.type || '');
    const resourceId = String(req.query?.id || '');
    if (!resourceId || !['music', 'profile', 'photo'].includes(type)) return json(res, 404, { error: 'Private media endpoint not found.' });
    if (type === 'music') {
      const track = (await query('SELECT id, storage_path, content_type, title FROM music_tracks WHERE id = $1 AND is_active = TRUE', [resourceId]))[0];
      if (!track) return json(res, 404, { error: 'Track not found.' });
      const blob = await getPrivateFile(track.storage_path);
      if (!blob?.stream) return json(res, 404, { error: 'Private audio file not found.' });
      await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'MUSIC_STREAM', resourceType: 'MUSIC', resourceId: track.id });
      return streamPrivateBlob(res, blob, track.content_type, `inline; filename="${encodeURIComponent(track.title)}"`);
    }
    const representative = (await query('SELECT id, profile_pdf_path, profile_photo_path FROM global_representatives WHERE id = $1 AND is_active = TRUE', [resourceId]))[0];
    const pathname = type === 'profile' ? representative?.profile_pdf_path : representative?.profile_photo_path;
    if (!pathname) return json(res, 404, { error: type === 'profile' ? 'Profile PDF not found.' : 'Profile photo not found.' });
    const blob = await getPrivateFile(pathname);
    if (!blob?.stream) return json(res, 404, { error: type === 'profile' ? 'Private profile PDF not found.' : 'Private profile photo not found.' });
    if (type === 'profile') {
      await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'PROFILE_PDF_VIEW', resourceType: 'GLOBAL_REP', resourceId: representative.id });
      return streamPrivateBlob(res, blob, 'application/pdf', 'inline; filename="nova-stage-global-profile.pdf"');
    }
    return streamPrivateBlob(res, blob, blob.blob?.contentType || 'image/jpeg');
  } catch (error) {
    if (!res.headersSent) return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to open private media.' });
    res.end();
  }
}
