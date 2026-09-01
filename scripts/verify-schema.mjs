import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const required = ['admin_users', 'admin_sessions', 'investor_access_codes', 'investor_sessions', 'music_tracks', 'global_representatives', 'private_documents', 'access_logs', 'login_rate_limits'];
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[]) ORDER BY table_name", [required]);
const found = rows.map((row) => row.table_name);
const missing = required.filter((name) => !found.includes(name));
if (missing.length) throw new Error(`Missing required tables: ${missing.join(', ')}`);
console.log(`Verified tables: ${found.join(', ')}`);
