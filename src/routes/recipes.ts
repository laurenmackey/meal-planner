import { Router, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import pool from "../db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { toMeal } from "../mappers";
import { ParsedIngredient, ParsedRecipe, MEASUREMENT_UNITS, PROTEINS } from "../types";

const router = Router();

const anthropic = new Anthropic();

async function fetchRecipePage(url: string): Promise<string> {
  const nytCookie = process.env.NYT_COOKING_COOKIE;
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (nytCookie && url.includes("nytimes.com")) {
    headers["Cookie"] = nytCookie;
  }

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch recipe page: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function parseRecipeWithClaude(html: string, url: string): Promise<ParsedRecipe> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Parse this recipe page HTML and extract the recipe data. Return ONLY valid JSON with no other text.

The JSON must match this exact structure:
{
  "name": "Recipe Name",
  "sourceName": "NYT Cooking",
  "description": "A short, practical one-sentence summary of what the dish is (e.g. 'Pasta with ground lamb, artichokes, and cherry tomatoes in a quick tomato sauce'). Do NOT copy the recipe's original description — write your own based on the key ingredients and cooking method. Set to null if the recipe name is already self-explanatory.",
  "prepTimeMinutes": number or null,
  "cookTimeMinutes": number or null,
  "mainProtein": one of [${PROTEINS.map(p => `"${p}"`).join(', ')}],
  "servingSize": number (how many people it serves),
  "ingredients": [
    {
      "name": "ingredient name (lowercase, singular or common form, e.g. 'onion' not 'yellow onion', 'garlic' not 'garlic cloves')",
      "quantity": number (convert fractions to decimals, e.g. 1/2 = 0.5, 1 1/2 = 1.5),
      "measurementUnit": one of [${MEASUREMENT_UNITS.map(u => `"${u}"`).join(', ')}],
      "optional": boolean,
      "notes": "any extra detail like 'diced', 'to taste', 'plus more for serving', or null"
    }
  ]
}

Important rules for standardization:
- measurementUnit MUST be one of the exact values listed above. Map common variations:
  - "pound", "pounds", "lb", "lbs" → "lb"
  - "ounce", "ounces", "oz" → "oz"
  - "cup", "cups" → "cups"
  - "tablespoon", "tablespoons", "Tbsp" → "tbsp"
  - "teaspoon", "teaspoons" → "tsp"
  - "gram", "grams" → "g"
  - "milliliter", "milliliters" → "ml"
  - "liter", "liters" → "l"
  - "clove", "cloves" → "cloves"
  - "pinch" → "pinch"
  - For items counted individually (e.g. "2 eggs", "1 lemon", "3 carrots") → "whole"
  - For "to taste", "as needed" → "to_taste" with quantity 1
- When a recipe uses volume measurements like "pints", "quarts", or "gallons", convert them to cups:
  - 1 pint = 2 cups, 1 quart = 4 cups, 1 gallon = 16 cups
  - Example: "2 pints cherry tomatoes" → quantity: 4, measurementUnit: "cups"
- Ingredient names should be lowercase and normalized:
  - "kosher salt", "sea salt", "fine salt" → "salt"
  - "extra-virgin olive oil", "EVOO" → "olive oil"
  - "freshly ground black pepper", "ground pepper" → "black pepper"
  - "red-pepper flakes", "crushed red pepper", "red pepper flakes" → "red pepper flakes"
  - Keep ingredient names specific enough to be useful (e.g. "cherry tomato" not just "tomato", "tomato paste" not "tomato")
  - Normalize specific pasta types (pappardelle, fettuccine, linguine, etc.) to "pasta" with the specific type in notes
  - Put adjectives like "dry", "unsalted", "fresh" in notes, not in the name (e.g. "dry white wine" → name: "white wine", notes: "dry")
- mainProtein should be "none" if the recipe is vegetarian/vegan or the protein doesn't match the list
- Only set optional to true if the recipe explicitly says "optional". An ingredient with a substitution (e.g. "ancho chile, or use chile powder instead") is NOT optional — it's required, with the substitution noted in notes
- Put preparation details (diced, minced, chopped, etc.) in notes, not in the name
- If the recipe says "ground lamb", the ingredient name should be "lamb" with "ground" in notes

Here is the HTML:

${html.substring(0, 50000)}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse recipe: no JSON in response");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    ...parsed,
    url,
    sourceName: parsed.sourceName || null,
  };
}

// POST /api/v1/parseRecipe
// Body: { url: string, text?: string }
// If text is provided, parse from that instead of fetching the URL
router.post("/parseRecipe", authenticate, async (req: AuthRequest, res: Response) => {
  const { url, text } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    const householdId = req.user!.householdId;
    const existing = await pool.query(
      "SELECT id FROM meals WHERE url = $1 AND household_id = $2",
      [url, householdId]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "This recipe has already been saved" });
      return;
    }

    const content = text || await fetchRecipePage(url);
    const recipe = await parseRecipeWithClaude(content, url);
    res.json(recipe);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error parsing recipe:", err);
    res.status(500).json({ error: "Failed to parse recipe", details: message });
  }
});

// POST /api/v1/saveRecipe
// Body: ParsedRecipe + { rating, easinessScore, healthScore }
router.post("/saveRecipe", authenticate, async (req: AuthRequest, res: Response) => {
  const { name, url, sourceName, description, notes, prepTimeMinutes, cookTimeMinutes, mainProtein, servingSize, ingredients, rating, easinessScore, healthScore } = req.body;
  const householdId = req.user!.householdId;

  if (!name || !rating || !easinessScore || !healthScore || !servingSize) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const mealResult = await client.query(
      `INSERT INTO meals (name, url, source_name, description, notes, prep_time_minutes, cook_time_minutes, main_protein, rating, easiness_score, health_score, serving_size, household_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [name, url || null, sourceName || null, description || null, notes || null, prepTimeMinutes || null, cookTimeMinutes || null, mainProtein || "none", rating, easinessScore, healthScore, servingSize, householdId]
    );

    const mealId = mealResult.rows[0].id;

    if (ingredients && ingredients.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const ing of ingredients) {
        placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
        values.push(mealId, ing.name, ing.quantity, ing.measurementUnit, ing.optional || false, ing.notes || null);
        paramIndex += 6;
      }

      await client.query(
        `INSERT INTO ingredients (meal_id, name, quantity, measurement_unit, optional, notes) VALUES ${placeholders.join(", ")}`,
        values
      );
    }

    await client.query("COMMIT");
    res.json({ mealId });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error saving recipe:", err);
    res.status(500).json({ error: "Failed to save recipe", details: message });
  } finally {
    client.release();
  }
});

// GET /api/v1/allMeals
// Returns all meals for the household with their ingredients
router.get("/allMeals", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  try {
    const mealsResult = await pool.query(
      "SELECT * FROM meals WHERE household_id = $1 ORDER BY name ASC",
      [householdId]
    );
    const meals = mealsResult.rows.map(toMeal);

    const ingredientsResult = await pool.query(
      `SELECT i.* FROM ingredients i
       JOIN meals m ON m.id = i.meal_id
       WHERE m.household_id = $1
       ORDER BY i.optional ASC, i.name ASC`,
      [householdId]
    );

    const ingredientsByMeal: Record<number, ParsedIngredient[]> = {};
    for (const row of ingredientsResult.rows) {
      if (!ingredientsByMeal[row.meal_id]) ingredientsByMeal[row.meal_id] = [];
      ingredientsByMeal[row.meal_id].push({
        id: row.id,
        name: row.name,
        quantity: Number(row.quantity),
        measurementUnit: row.measurement_unit,
        optional: row.optional,
        notes: row.notes,
      });
    }

    const mealsWithIngredients = meals.map((meal) => ({
      ...meal,
      ingredients: ingredientsByMeal[meal.id] || [],
    }));

    res.json({ meals: mealsWithIngredients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error fetching all meals:", err);
    res.status(500).json({ error: "Failed to fetch meals", details: message });
  }
});

// PUT /api/v1/meals/:id
// Update a meal's fields
router.put("/meals/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const mealId = Number(req.params.id);
  const { name, description, notes, url, sourceName, prepTimeMinutes, cookTimeMinutes, mainProtein, rating, easinessScore, healthScore, servingSize } = req.body;

  try {
    const result = await pool.query(
      `UPDATE meals SET
        name = COALESCE($1, name),
        description = $2,
        notes = $3,
        url = $4,
        source_name = $5,
        prep_time_minutes = $6,
        cook_time_minutes = $7,
        main_protein = $8,
        rating = COALESCE($9, rating),
        easiness_score = COALESCE($10, easiness_score),
        health_score = COALESCE($11, health_score),
        serving_size = COALESCE($12, serving_size),
        updated_at = NOW()
      WHERE id = $13 AND household_id = $14
      RETURNING *`,
      [name, description, notes, url, sourceName, prepTimeMinutes, cookTimeMinutes, mainProtein, rating, easinessScore, healthScore, servingSize, mealId, householdId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Meal not found" });
      return;
    }

    res.json({ meal: toMeal(result.rows[0]) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error updating meal:", err);
    res.status(500).json({ error: "Failed to update meal", details: message });
  }
});

// PUT /api/v1/meals/:id/ingredients
// Update ingredients for a meal: update existing, insert new, delete removed
router.put("/meals/:id/ingredients", authenticate, async (req: AuthRequest, res: Response) => {
  const householdId = req.user!.householdId;
  const mealId = Number(req.params.id);
  const { ingredients } = req.body as { ingredients: ParsedIngredient[] };

  try {
    const mealCheck = await pool.query(
      "SELECT id FROM meals WHERE id = $1 AND household_id = $2",
      [mealId, householdId]
    );
    if (mealCheck.rows.length === 0) {
      res.status(404).json({ error: "Meal not found" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const incomingIds = ingredients.filter((ing) => ing.id).map((ing) => ing.id!);

      // Delete ingredients that were removed
      if (incomingIds.length > 0) {
        await client.query(
          "DELETE FROM ingredients WHERE meal_id = $1 AND id != ALL($2)",
          [mealId, incomingIds]
        );
      } else {
        await client.query("DELETE FROM ingredients WHERE meal_id = $1", [mealId]);
      }

      const resultIngredients: ParsedIngredient[] = [];

      for (const ing of ingredients) {
        if (ing.id) {
          // Update existing
          const result = await client.query(
            `UPDATE ingredients SET name = $1, quantity = $2, measurement_unit = $3, optional = $4, notes = $5
             WHERE id = $6 AND meal_id = $7 RETURNING id`,
            [ing.name, ing.quantity, ing.measurementUnit, ing.optional, ing.notes, ing.id, mealId]
          );
          resultIngredients.push({ ...ing, id: result.rows[0]?.id ?? ing.id });
        } else {
          // Insert new
          const result = await client.query(
            `INSERT INTO ingredients (meal_id, name, quantity, measurement_unit, optional, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [mealId, ing.name, ing.quantity, ing.measurementUnit, ing.optional, ing.notes]
          );
          resultIngredients.push({ ...ing, id: result.rows[0].id });
        }
      }

      await client.query("COMMIT");
      res.json({ ingredients: resultIngredients });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error updating ingredients:", err);
    res.status(500).json({ error: "Failed to update ingredients", details: message });
  }
});

export default router;
