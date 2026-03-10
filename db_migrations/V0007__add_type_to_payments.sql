ALTER TABLE t_p72941365_black_screen_menu_pr.payments
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'deposit';
