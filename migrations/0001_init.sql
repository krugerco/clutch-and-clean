-- Clutch & Clean back office — initial schema (Cloudflare D1 / SQLite)
-- Money is stored as integer cents to avoid rounding errors.

-- Inquiries from the website form (potential work).
CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  name        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  vehicle     TEXT,
  service     TEXT,
  message     TEXT,
  source      TEXT NOT NULL DEFAULT 'website',
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','contacted','quoted','booked','lost')),
  notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at);

-- Cleanings / jobs, scheduled or done. Each job doubles as an invoice.
CREATE TABLE IF NOT EXISTS jobs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  job_date           TEXT NOT NULL,              -- YYYY-MM-DD
  status             TEXT NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('scheduled','completed','cancelled')),
  customer_name      TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  address            TEXT,
  vehicle            TEXT,
  service            TEXT,
  addons             TEXT,
  price_cents        INTEGER NOT NULL DEFAULT 0, -- what you charged
  tip_cents          INTEGER NOT NULL DEFAULT 0,
  supply_cost_cents  INTEGER NOT NULL DEFAULT 0, -- chemicals, towels, etc. used on this job
  other_cost_cents   INTEGER NOT NULL DEFAULT 0, -- anything else specific to this job
  miles              REAL NOT NULL DEFAULT 0,
  hours              REAL NOT NULL DEFAULT 0,
  invoice_no         TEXT UNIQUE,
  paid               INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0,1)),
  paid_date          TEXT,
  payment_method     TEXT,
  notes              TEXT,
  lead_id            INTEGER REFERENCES leads(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(job_date);

-- General business expenses not tied to one job (equipment, bulk supplies, fuel, ads...).
CREATE TABLE IF NOT EXISTS expenses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expense_date  TEXT NOT NULL,                   -- YYYY-MM-DD
  category      TEXT NOT NULL DEFAULT 'supplies',
  vendor        TEXT,
  description   TEXT,
  amount_cents  INTEGER NOT NULL DEFAULT 0,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
