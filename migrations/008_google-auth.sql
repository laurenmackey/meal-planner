-- Allow Google OAuth login: add google_id, make password_hash nullable
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
