import { neon } from '@neondatabase/serverless';
import { requireEnvironment } from './config.js';

let client;
export function sql() {
  requireEnvironment('DATABASE_URL');
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}

export async function query(statement, params = []) {
  return sql().query(statement, params);
}

export async function logAccess({ actorType, actorId = null, eventType, resourceType = null, resourceId = null, metadata = {} }) {
  const { id } = await import('./crypto.js');
  await query(
    'INSERT INTO access_logs (id, actor_type, actor_id, event_type, resource_type, resource_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)',
    [id(), actorType, actorId, eventType, resourceType, resourceId, JSON.stringify(metadata)]
  );
}
