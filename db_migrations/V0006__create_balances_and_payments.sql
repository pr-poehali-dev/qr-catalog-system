
CREATE TABLE user_balances (
    user_id TEXT PRIMARY KEY,
    balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    invoice_id BIGINT UNIQUE NOT NULL,
    amount NUMERIC(18, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    pay_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
