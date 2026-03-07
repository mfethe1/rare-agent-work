ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;
CREATE INDEX IF NOT EXISTS idx_users_session_token ON users(session_token);
