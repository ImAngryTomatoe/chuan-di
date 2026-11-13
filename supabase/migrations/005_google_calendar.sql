-- Part 2: Google Calendar OAuth 2.0 Connections, Selected Sources & Free/Busy Sync
CREATE TABLE IF NOT EXISTS google_oauth_states (
  state TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,
  redirect_path TEXT NOT NULL DEFAULT '/settings',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  google_email TEXT,
  google_account_sub TEXT,
  scope TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'connected',
  sync_error TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_window_start DATE,
  sync_window_end DATE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS google_calendar_sources (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  access_role TEXT NOT NULL DEFAULT 'reader',
  background_color TEXT,
  time_zone TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, calendar_id)
);

CREATE TABLE IF NOT EXISTS google_freebusy_blocks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL,
  start_utc TIMESTAMPTZ NOT NULL,
  end_utc TIMESTAMPTZ NOT NULL,
  bangkok_date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcal_busy_user_date ON google_freebusy_blocks(user_id, bangkok_date);
