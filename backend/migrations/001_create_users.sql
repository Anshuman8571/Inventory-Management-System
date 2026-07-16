-- Users table: owner + staff accounts. Created manually via seed script, no public signup.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  created_at    TIMESTAMP DEFAULT now()
);
