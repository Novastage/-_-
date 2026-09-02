import { readdir, readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Set it in your local environment before running migrations.');
const sql = neon(process.env.DATABASE_URL);
const migrationDirectory = new URL('../db/migrations/', import.meta.url);
const migrations = (await readdir(migrationDirectory)).filter((file) => file.endsWith('.sql')).sort();
for (const filename of migrations) {
  const migration = await readFile(new URL(`../db/migrations/${filename}`, import.meta.url), 'utf8');
  for (const statement of migration.split(';').map((item) => item.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
  console.log(`Migration ${filename} applied.`);
}
