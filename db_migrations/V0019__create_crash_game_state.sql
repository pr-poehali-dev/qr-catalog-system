CREATE TABLE crash_game_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  round_id INTEGER NOT NULL DEFAULT 1,
  crash_point NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  phase VARCHAR(20) NOT NULL DEFAULT 'waiting',
  started_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO crash_game_state (round_id, crash_point, phase) VALUES (1, 1.00, 'waiting');