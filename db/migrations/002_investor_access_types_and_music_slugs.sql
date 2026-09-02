ALTER TABLE investor_access_codes
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'ONE_TIME';

ALTER TABLE music_tracks
  ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_music_tracks_slug_unique
  ON music_tracks (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_music_tracks_slug_visible
  ON music_tracks (slug, is_active)
  WHERE slug IS NOT NULL;
