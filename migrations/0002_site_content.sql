-- Editable website content + PIN sign-in protection.

-- Key/value settings: 'pricing' and 'testimonials' (JSON), 'pin_hash' / 'pin_salt' (admin PIN).
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Failed sign-in attempts, used to lock out PIN guessing (5 tries / 15 minutes per IP).
CREATE TABLE IF NOT EXISTS auth_fails (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  ip  TEXT NOT NULL,
  at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_fails_ip ON auth_fails(ip, at);

-- Before & after photo pairs shown on the website. Image files live in R2 (PHOTOS bucket).
CREATE TABLE IF NOT EXISTS photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  title       TEXT,
  caption     TEXT,
  before_key  TEXT NOT NULL,
  after_key   TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  visible     INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1))
);
