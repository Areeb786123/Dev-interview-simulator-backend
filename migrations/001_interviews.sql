-- Interview sessions + evaluation history

CREATE TABLE IF NOT EXISTS interviews (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL,
  level_id        TEXT NOT NULL,
  map_id          TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN (
    'IN_PROGRESS', 'NEEDS_REVISION', 'PASSED', 'FAILED', 'ABANDONED'
  )),
  evaluate_attempts INTEGER NOT NULL DEFAULT 0,
  answer_attempts   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL,
  latest_architecture JSONB,
  latest_evaluation   JSONB,
  pending_follow_up   JSONB,
  history         JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_usage     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS interviews_client_id_idx ON interviews (client_id);
CREATE INDEX IF NOT EXISTS interviews_level_id_idx ON interviews (level_id);
CREATE INDEX IF NOT EXISTS interviews_updated_at_idx ON interviews (updated_at DESC);
