-- Add is_basic flag to meals
ALTER TABLE meals ADD COLUMN is_basic BOOLEAN NOT NULL DEFAULT FALSE;

-- Add basic_meal_count setting to households
ALTER TABLE households ADD COLUMN basic_meal_count INTEGER NOT NULL DEFAULT 2;
