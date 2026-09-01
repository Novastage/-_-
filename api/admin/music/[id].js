import { requireAdmin } from '../../_lib/auth.js';
import { removePrivateFile } from '../../_lib/blob.js';
import { logAccess, query } from '../../_lib/db.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    if (req.method === 'PATCH') {
      const fields = ['title', 'genre', 'concept', 'targetArtist', 'description', 'displayOrder', 'isActive'];
      const body = req.body || {};
      const updated = await query(
        'UPDATE music_tracks SET title = COALESCE($2, title), genre = COALESCE($3, genre), concept = COALESCE($4, concept), target_artist = COALESCE($5, target_artist), description = COALESCE($6, description), display_order = COALESCE($7, display_order), is_active = COALESCE($8, is_active), updated_at = NOW() WHERE id = $1 RETURNING id',
        [req.query.id, body.title ?? null, body.genre ?? null, body.concept ?? null, body.targetArtist ?? null, body.description ?? null, Number.isInteger(body.displayOrder) ? body.displayOrder : null, typeof body.isActive === 'boolean' ? body.isActive : null]
      );
      if (!updated[0]) return json(res, 404, { error: 'Track not found.' });
      await logAccess({ actorType: 'ADMIN', actorId: admin.admin_user_id, eventType: 'MUSIC_UPDATED', resourceType: 'MUSIC', resourceId: req.query.id });
      return json(res, 200, { ok: true });
    }
    if (req.method !== 'DELETE') return methodNotAllowed(res, ['PATCH', 'DELETE']);
    const rows = await query('DELETE FROM music_tracks WHERE id = $1 RETURNING storage_path', [req.query.id]);
    if (!rows[0]) return json(res, 404, { error: 'Track not found.' });
    await removePrivateFile(rows[0].storage_path);
    await logAccess({ actorType: 'ADMIN', actorId: admin.admin_user_id, eventType: 'MUSIC_DELETED', resourceType: 'MUSIC', resourceId: req.query.id });
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.code === 'CONFIGURATION_REQUIRED' ? 503 : 500, { error: 'Unable to update music.' });
  }
}
