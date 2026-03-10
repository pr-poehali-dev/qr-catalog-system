CREATE TABLE crash_rounds (
  id SERIAL PRIMARY KEY,
  crash_point NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_crash_rounds_created ON crash_rounds(created_at DESC);