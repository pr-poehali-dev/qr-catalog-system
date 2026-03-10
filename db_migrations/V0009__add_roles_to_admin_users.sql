
ALTER TABLE t_p72941365_black_screen_menu_pr.admin_users
ADD COLUMN IF NOT EXISTS role INTEGER NOT NULL DEFAULT 2;

-- role: 1 = Гл.Администратор, 2 = Администратор, 3 = Тех.Специалист

UPDATE t_p72941365_black_screen_menu_pr.admin_users SET role = 1 WHERE display_id = 4003134;

ALTER TABLE t_p72941365_black_screen_menu_pr.admin_users
ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '';
