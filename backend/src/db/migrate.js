const pool = require('./pool');

const schema = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'agent'
                CHECK (role IN ('admin', 'supervisor', 'agent')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ============================================================
-- INVITATIONS
-- ============================================================
CREATE TABLE invitations (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(150) NOT NULL,
  role        VARCHAR(20) NOT NULL
                CHECK (role IN ('admin', 'supervisor', 'agent')),
  token       VARCHAR(255) UNIQUE NOT NULL,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_created_at ON invitations(created_at);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE clients (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  phone       VARCHAR(30)  UNIQUE NOT NULL,
  email       VARCHAR(150),
  company     VARCHAR(150),
  notes_count INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_name  ON clients(name);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  parent_id   INT REFERENCES categories(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ============================================================
-- NOTES / ISSUES
-- ============================================================
CREATE TABLE notes (
  id           SERIAL PRIMARY KEY,
  client_id    INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id     INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id  INT REFERENCES categories(id) ON DELETE SET NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  priority     VARCHAR(10) NOT NULL DEFAULT 'Medium'
                 CHECK (priority IN ('Low', 'Medium', 'High')),
  status       VARCHAR(20) NOT NULL DEFAULT 'Open'
                 CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  counter      INT NOT NULL DEFAULT 1 CHECK (counter >= 1),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_client_id   ON notes(client_id);
CREATE INDEX idx_notes_agent_id    ON notes(agent_id);
CREATE INDEX idx_notes_category_id ON notes(category_id);
CREATE INDEX idx_notes_status      ON notes(status);
CREATE INDEX idx_notes_priority    ON notes(priority);
CREATE INDEX idx_notes_title       ON notes USING gin(to_tsvector('english', title));
CREATE INDEX idx_notes_created_at  ON notes(created_at);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE activity_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   INT,
  target_name VARCHAR(255),
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_user_id    ON activity_logs(user_id);
CREATE INDEX idx_activity_created_at ON activity_logs(created_at);
CREATE INDEX idx_activity_action     ON activity_logs(action);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-SYNC notes_count ON clients
-- ============================================================
CREATE OR REPLACE FUNCTION sync_client_notes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE clients SET notes_count = notes_count + 1 WHERE id = NEW.client_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE clients SET notes_count = GREATEST(notes_count - 1, 0) WHERE id = OLD.client_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notes_count
  AFTER INSERT OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION sync_client_notes_count();
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(schema);
    console.log('✓ Schema created successfully');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
