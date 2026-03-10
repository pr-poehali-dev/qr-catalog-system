INSERT INTO game_settings (game_name, win_chance) VALUES ('crash', 50)
ON CONFLICT (game_name) DO NOTHING;

ALTER TABLE crash_game_state ADD COLUMN IF NOT EXISTS force_crash NUMERIC(10,2) DEFAULT 0;
ALTER TABLE crash_game_state ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'fair';