CREATE TABLE IF NOT EXISTS voucher_uses (
  id SERIAL PRIMARY KEY,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
  user_id INTEGER NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voucher_id, user_id)
);
