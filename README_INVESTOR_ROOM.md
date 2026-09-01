# NOVA STAGE Investor Room

The existing public landing page remains at `/`. This feature adds only `/investor/`, `/admin/`, and Vercel Functions under `/api/`.

## Required Vercel environment variables

Set these in the existing Vercel project's **Production** environment. Do not put values in Git.

- `DATABASE_URL` — Neon pooled connection string
- `SESSION_SECRET` — 32+ random bytes for investor sessions
- `ADMIN_SESSION_SECRET` — separate 32+ random bytes for administrator sessions
- `ACCESS_CODE_PEPPER` — separate 32+ random bytes for access-code and rate-limit HMACs
- `BLOB_READ_WRITE_TOKEN` — token for the project's **private** Vercel Blob store
- `INVESTOR_SESSION_DURATION_SECONDS` — optional; default `7200`
- `ADMIN_SESSION_DURATION_SECONDS` — optional; default `28800`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` — optional; default `8`
- `LOGIN_RATE_LIMIT_WINDOW_SECONDS` — optional; default `900`
- `MAX_AUDIO_UPLOAD_BYTES` and `MAX_PDF_UPLOAD_BYTES` — optional; default `4194304`

For a local migration, set the same values in a local `.env` file (ignored by Git) and load it through your shell or Vercel CLI. `INITIAL_ADMIN_PASSWORD` is only used locally by the account-creation command and must never be committed.

## Database

Use Neon Serverless Postgres. Create a Neon project/database, copy its pooled `DATABASE_URL` to Vercel, then run:

```powershell
npm install
npm run migrate
$env:INITIAL_ADMIN_PASSWORD = 'use-a-unique-14-character-or-longer-password'
npm run create-admin -- admin@novastage.example
```

The migration in `db/migrations/001_investor_room.sql` creates admin users/sessions, one-time access codes, investor sessions, music, global representatives, audit logs, and login rate-limit records.

## Private storage and large uploads

Create or attach a **private** Vercel Blob store to the same existing Vercel project and add its generated `BLOB_READ_WRITE_TOKEN`. Admin uploads first obtain a short-lived, content-type-restricted token from `/api/upload`; only an authenticated administrator can obtain it. The browser then uploads directly to the private Blob store, including multipart uploads for files over 100 MB. The server callback writes only the Blob pathname to the database. Blob URLs are never rendered in the admin or investor UI.

This avoids the Vercel Function request-body limit for large music/PDF files. Investors receive audio/PDF/photo bytes only through authenticated `/api/investor/...` proxy endpoints; no download controls or public media links are provided.

## Operational URLs

- Public site: `/`
- Investor entry: `/investor/`
- Investor room: `/investor/room/`
- Music library: `/investor/music/`
- Global representatives: `/investor/global/`
- Admin login/dashboard: `/admin/`

Static investor/admin pages contain no protected records. Their JavaScript immediately verifies the server session and redirects unauthenticated visitors. All sensitive data and private media remain behind server-side API authorization.
