CREATE TABLE IF NOT EXISTS game_settings (
    game_name TEXT PRIMARY KEY,
    win_chance INTEGER NOT NULL DEFAULT 50,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO game_settings (game_name, win_chance) VALUES ('mines', 50)
ON CONFLICT (game_name) DO NOTHING;