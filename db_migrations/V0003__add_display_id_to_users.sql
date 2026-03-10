ALTER TABLE t_p72941365_black_screen_menu_pr.users ADD COLUMN display_id integer;

UPDATE t_p72941365_black_screen_menu_pr.users SET display_id = 1000000 + floor(random() * 9000000)::integer;

ALTER TABLE t_p72941365_black_screen_menu_pr.users ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE t_p72941365_black_screen_menu_pr.users ALTER COLUMN display_id SET DEFAULT (1000000 + floor(random() * 9000000)::integer);
ALTER TABLE t_p72941365_black_screen_menu_pr.users ADD CONSTRAINT users_display_id_unique UNIQUE (display_id);