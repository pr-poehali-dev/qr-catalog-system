
CREATE TABLE IF NOT EXISTS t_p72941365_black_screen_menu_pr.withdrawal_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    display_id INTEGER NOT NULL,
    user_name VARCHAR(255) DEFAULT '',
    network VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    processed_by INTEGER NULL
);
