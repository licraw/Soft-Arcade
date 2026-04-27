CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  player_name TEXT NOT NULL,
  moves INTEGER NOT NULL,
  time_seconds INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_level_rank
ON scores (level, moves, time_seconds, created_at);

CREATE INDEX IF NOT EXISTS idx_scores_ip_hash_created_at
ON scores (ip_hash, created_at);
