-- Migration: Seed sample data

-- Tags
INSERT INTO tags (name) VALUES
    ('weeknight'),
    ('slow-cooker'),
    ('one-pot'),
    ('grilling'),
    ('meal-prep'),
    ('comfort-food'),
    ('light'),
    ('kid-friendly');

-- Meals
INSERT INTO meals (name, url, source_name, description, main_protein, rating, easiness_score, health_score, serving_size) VALUES
    ('Chicken Stir Fry', NULL, NULL, 'Quick veggie and chicken stir fry with soy sauce and rice', 'chicken', 8, 9, 8, 4),
    ('Salmon with Roasted Vegetables', NULL, 'NYT Cooking', 'Baked salmon with seasonal roasted vegetables', 'fish', 9, 7, 9, 4),
    ('Beef Tacos', NULL, NULL, 'Ground beef tacos with all the fixings', 'beef', 8, 9, 6, 4),
    ('Pasta Primavera', NULL, NULL, 'Pasta with fresh vegetables in a light garlic sauce', 'none', 7, 8, 7, 4),
    ('Shrimp Scampi', NULL, 'NYT Cooking', 'Shrimp in garlic butter sauce over linguine', 'shrimp', 9, 7, 6, 4);

-- Meal tags
INSERT INTO meal_tags (meal_id, tag_id) VALUES
    (1, 1),  -- Chicken Stir Fry: weeknight
    (1, 3),  -- Chicken Stir Fry: one-pot
    (2, 7),  -- Salmon: light
    (3, 1),  -- Beef Tacos: weeknight
    (3, 8),  -- Beef Tacos: kid-friendly
    (4, 1),  -- Pasta Primavera: weeknight
    (4, 3),  -- Pasta Primavera: one-pot
    (5, 1);  -- Shrimp Scampi: weeknight

-- Ingredients (just a few per meal to start)
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
INSERT INTO food_staples (name) VALUES
    ('milk'),
    ('eggs'),
    ('bread'),
    ('butter'),
    ('bananas'),
    ('onions');
