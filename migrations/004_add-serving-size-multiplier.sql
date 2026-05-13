-- Add serving_size_multiplier to food_selections
ALTER TABLE food_selections
  ADD COLUMN serving_size_multiplier NUMERIC(3,1) NOT NULL DEFAULT 1
  CHECK (serving_size_multiplier IN (1, 1.5, 2, 3));
