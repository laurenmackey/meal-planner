-- Seed script: Run manually after creating your household
-- Usage: psql -d meal_planner -v household_id=1 -f migrations/002_seed-data.sql

-- Meals
INSERT INTO meals (name, url, source_name, description, main_protein, rating, easiness_score, health_score, serving_size, household_id) VALUES
    ('Chicken Stir Fry', NULL, NULL, 'Quick veggie and chicken stir fry with soy sauce and rice', 'chicken', 8, 9, 8, 4, :household_id),
    ('Salmon with Roasted Vegetables', NULL, 'NYT Cooking', 'Baked salmon with seasonal roasted vegetables', 'fish', 9, 7, 9, 4, :household_id),
    ('Beef Tacos', NULL, NULL, 'Ground beef tacos with all the fixings', 'beef', 8, 9, 6, 4, :household_id),
    ('Pasta Primavera', NULL, NULL, 'Pasta with fresh vegetables in a light garlic sauce', 'none', 7, 8, 7, 4, :household_id),
    ('Shrimp Scampi', NULL, 'NYT Cooking', 'Shrimp in garlic butter sauce over linguine', 'shrimp', 9, 7, 6, 4, :household_id);

-- Ingredients
INSERT INTO ingredients (meal_id, name, quantity, measurement_unit) VALUES
    -- Chicken Stir Fry
    (1, 'chicken breast', 1.5, 'lb'),
    (1, 'soy sauce', 3, 'tbsp'),
    (1, 'rice', 2, 'cups'),
    (1, 'broccoli', 2, 'cups'),
    (1, 'garlic', 3, 'cloves'),
    -- Salmon
    (2, 'salmon fillet', 1.5, 'lb'),
    (2, 'olive oil', 2, 'tbsp'),
    (2, 'lemon', 1, 'whole'),
    -- Beef Tacos
    (3, 'ground beef', 1, 'lb'),
    (3, 'taco shells', 8, 'whole'),
    (3, 'cheddar cheese', 4, 'oz'),
    -- Pasta Primavera
    (4, 'pasta', 1, 'lb'),
    (4, 'zucchini', 2, 'whole'),
    (4, 'garlic', 4, 'cloves'),
    (4, 'olive oil', 2, 'tbsp'),
    -- Shrimp Scampi
    (5, 'shrimp', 1, 'lb'),
    (5, 'linguine', 1, 'lb'),
    (5, 'butter', 4, 'tbsp'),
    (5, 'garlic', 5, 'cloves');

-- Food staples
INSERT INTO food_staples (name, household_id) VALUES
    ('milk', :household_id),
    ('blueberries', :household_id),
    ('raspberries', :household_id),
    ('bananas', :household_id);