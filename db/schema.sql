-- Pundit Arena schema. Apply once against your DATABASE_URL:
--   psql "$DATABASE_URL" -f db/schema.sql
-- Vercel Postgres / Neon / Supabase all work; nothing here is vendor specific.

CREATE TABLE IF NOT EXISTS app_state (
  id          SMALLINT PRIMARY KEY,
  data        JSONB      NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The whole document lives in one row and is read-modify-written under a
-- transaction-scoped advisory lock (key 748291), so any number of serverless
-- instances can share it without losing writes.

CREATE TABLE IF NOT EXISTS rate_window (
  bucket       TEXT        PRIMARY KEY,
  window_start BIGINT      NOT NULL,
  count        INTEGER     NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per limiter name + client IP + fixed window, so limits hold across
-- lambda instances instead of resetting with each cold start.
