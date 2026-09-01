import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const email = String(process.argv[2] || '').trim().toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (!email || !password || password.length < 14) throw new Error('Usage: INITIAL_ADMIN_PASSWORD=<14+ char password> node scripts/create-admin.mjs admin@example.com');
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
const sql = neon(process.env.DATABASE_URL);
const rows = await sql.query('INSERT INTO admin_users (id, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = TRUE RETURNING email', [crypto.randomUUID(), email, `scrypt$${salt}$${hash}`]);
console.log(`Admin account ready: ${rows[0].email}`);
