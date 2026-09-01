CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investor_access_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT UNIQUE NOT NULL,
  investor_label TEXT NOT NULL,
  company TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'UNUSED' CHECK (status IN ('UNUSED', 'ACTIVE_SESSION', 'USED', 'REVOKED', 'EXPIRED')),
  expires_at TIMESTAMPTZ,
  first_access_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS investor_sessions (
  id TEXT PRIMARY KEY,
  access_code_id TEXT NOT NULL REFERENCES investor_access_codes(id) ON DELETE RESTRICT,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('MALE', 'FEMALE')),
  genre TEXT,
  concept TEXT,
  target_artist TEXT,
  description TEXT,
  storage_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_representatives (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  name TEXT,
  position TEXT,
  role TEXT,
  short_bio TEXT,
  profile_photo_path TEXT,
  profile_pdf_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('INVESTOR', 'ADMIN', 'SYSTEM')),
  actor_id TEXT,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_investor_sessions_token ON investor_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_investor_sessions_active ON investor_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_access_codes_status ON investor_access_codes(status);
CREATE INDEX IF NOT EXISTS idx_music_tracks_visible ON music_tracks(is_active, category, display_order);
CREATE INDEX IF NOT EXISTS idx_global_representatives_visible ON global_representatives(is_active, country, display_order);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at DESC);
