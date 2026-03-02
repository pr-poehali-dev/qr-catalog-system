CREATE TABLE IF NOT EXISTS t_p94663306_qr_catalog_system.products (
    article TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT '',
    params TEXT NOT NULL DEFAULT '',
    price TEXT NOT NULL DEFAULT '',
    gallery TEXT NOT NULL DEFAULT '',
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);