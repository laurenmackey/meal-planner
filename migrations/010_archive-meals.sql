-- Add is_archived flag to meals
ALTER TABLE meals ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
