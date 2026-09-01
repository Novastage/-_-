import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Set it in your local environment before running migrations.');
const sql = neon(process.env.DATABASE_URL);
const migration = await readFile(new URL('../db/migrations/001_investor_room.sql', import.meta.url), 'utf8');
for (const statement of migration.split(';').map((item) => item.trim()).filter(Boolean)) {
  await sql.query(statement);
}
console.log('Investor Room migration 001 applied.');
