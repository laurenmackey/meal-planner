-- Migration: Create initial tables

CREATE TABLE meals (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    url TEXT,
    source_name TEXT,
    description TEXT,
    notes TEXT,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    main_protein TEXT CHECK (main_protein IN ('chicken', 'beef', 'pork', 'turkey', 'fish', 'shrimp', 'prawns', 'crab', 'tofu', 'none', 'other')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    easiness_score INTEGER NOT NULL CHECK (easiness_score >= 1 AND easiness_score <= 10),
    health_score INTEGER NOT NULL CHECK (health_score >= 1 AND health_score <= 10),
    serving_size INTEGER NOT NULL
);

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE meal_tags (
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (meal_id, tag_id)
);

CREATE TABLE food_staples (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    notes TEXT
);

CREATE TABLE food_selections (
    id SERIAL PRIMARY KEY,
    chosen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'rejected', 'accepted')),
    meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
    food_staple_id INTEGER REFERENCES food_staples(id) ON DELETE CASCADE,
    CONSTRAINT must_have_meal_or_staple CHECK (
        (meal_id IS NOT NULL AND food_staple_id IS NULL) OR
        (meal_id IS NULL AND food_staple_id IS NOT NULL)
    )
);

CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    optional BOOLEAN NOT NULL DEFAULT FALSE,
    quantity DECIMAL NOT NULL,
    measurement_unit TEXT CHECK (measurement_unit IN ('cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'ml', 'l', 'whole', 'cloves', 'pinch', 'to_taste')),
    notes TEXT
);

-- Indexes
CREATE INDEX idx_food_selections_meal_id ON food_selections(meal_id);
CREATE INDEX idx_food_selections_food_staple_id ON food_selections(food_staple_id);
CREATE INDEX idx_food_selections_chosen_at ON food_selections(chosen_at);
CREATE INDEX idx_ingredients_meal_id ON ingredients(meal_id);
CREATE INDEX idx_meal_tags_tag_id ON meal_tags(tag_id);
