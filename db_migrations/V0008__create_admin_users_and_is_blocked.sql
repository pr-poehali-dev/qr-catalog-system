
CREATE TABLE IF NOT EXISTS t_p72941365_black_screen_menu_pr.admin_users (
    id SERIAL PRIMARY KEY,
    display_id INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO t_p72941365_black_screen_menu_pr.admin_users (display_id) VALUES (4003134);

ALTER TABLE t_p72941365_black_screen_menu_pr.users 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
