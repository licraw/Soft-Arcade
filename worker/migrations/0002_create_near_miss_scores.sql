CREATE TABLE IF NOT EXISTS near_miss_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  distance INTEGER NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  near_misses INTEGER NOT NULL,
  average_speed INTEGER NOT NULL,
  scoring_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_near_miss_scores_rank
ON near_miss_scores (score DESC, created_at);

CREATE INDEX IF NOT EXISTS idx_near_miss_scores_ip_hash_created_at
ON near_miss_scores (ip_hash, created_at);
