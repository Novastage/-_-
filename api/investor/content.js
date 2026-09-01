import { requireInvestor } from '../_lib/auth.js';
import { logAccess, query } from '../_lib/db.js';
import { json, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const session = await requireInvestor(req, res);
    if (!session) return;
    const type = String(req.query?.type || '');
    if (type === 'overview') {
      const [music] = await query('SELECT COUNT(*)::int AS count FROM music_tracks WHERE is_active = TRUE');
      const [global] = await query('SELECT COUNT(*)::int AS count FROM global_representatives WHERE is_active = TRUE');
      await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'INVESTOR_OVERVIEW_ACCESS' });
      return json(res, 200, { investor: { label: session.investor_label, company: session.company }, counts: { music: music.count, global: global.count } });
    }
    if (type === 'music') {
      const tracks = await query("SELECT id, title, category, genre, concept, target_artist, description FROM music_tracks WHERE is_active = TRUE ORDER BY category, display_order, created_at DESC");
      await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'MUSIC_LIBRARY_ACCESS' });
      return json(res, 200, { tracks: tracks.map((track) => ({ ...track, streamUrl: `/api/investor/media?type=music&id=${encodeURIComponent(track.id)}` })) });
    }
    if (type === 'global') {
      const representatives = await query('SELECT id, country, name, position, role, short_bio, profile_photo_path FROM global_representatives WHERE is_active = TRUE ORDER BY display_order, country');
      await logAccess({ actorType: 'INVESTOR', actorId: session.access_code_id, eventType: 'GLOBAL_REP_ACCESS' });
      return json(res, 200, { representatives: representatives.map((rep) => ({ ...rep, profilePdfUrl: `/api/investor/media?type=profile&id=${encodeURIComponent(rep.id)}`, profilePhotoUrl: rep.profile_photo_path ? `/api/investor/media?type=photo&id=${encodeURIComponent(rep.id)}` : null, profile_photo_path: undefined })) });
    }
    return json(res, 404, { error: 'Private content endpoint not found.' });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to load private content.' });
  }
}
