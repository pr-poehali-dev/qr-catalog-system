CREATE TABLE IF NOT EXISTS t_p94663306_qr_catalog_system.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO t_p94663306_qr_catalog_system.settings (key, value)
VALUES ('catalog_password', '2024')
ON CONFLICT (key) DO NOTHING;