CREATE TABLE IF NOT EXISTS sk8_state (
  game_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
