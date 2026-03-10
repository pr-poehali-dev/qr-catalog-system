ALTER TABLE t_p72941365_black_screen_menu_pr.users DROP CONSTRAINT users_email_key;

CREATE UNIQUE INDEX users_email_unique ON t_p72941365_black_screen_menu_pr.users (email) WHERE email != '';