import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { MealSelection, AggregatedIngredient, MEASUREMENT_UNITS } from "../../src/types";
import MealCard from "./components/MealCard";
import AuthPage from "./components/AuthPage";
import AddRecipePage from "./components/AddRecipePage";
import MealHistoryPage from "./components/MealHistoryPage";
import AppHeader from "./components/AppHeader";
import { apiFetch } from "./api";
import "./App.css";

const DEFAULT_COUNT = 3;

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiFetch("/api/v1/me");
        setAuthed(res.ok);
      } catch {
        setAuthed(false);
      }
    };
    checkAuth();
  }, []);

  if (authed === null) return null;

  if (!authed) {
    return <AuthPage onAuth={() => setAuthed(true)} />;
  }

  const handleLogout = () => setAuthed(false);

  return (
    <Routes>
      <Route path="/" element={<HomePage onLogout={handleLogout} />} />
      <Route path="/add-recipe" element={<AddRecipePage onLogout={handleLogout} />} />
      <Route path="/history" element={<MealHistoryPage onLogout={handleLogout} />} />
    </Routes>
  );
}

function HomePage({ onLogout }: { onLogout: () => void }) {
  const [countInput, setCountInput] = useState(String(DEFAULT_COUNT));
  const count = countInput === "" ? 0 : Number(countInput);
  const [meals, setMeals] = useState<MealSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showIncludeAll, setShowIncludeAll] = useState(false);
  const [ingredients, setIngredients] = useState<AggregatedIngredient[] | null>(null);
  const [generatingIngredients, setGeneratingIngredients] = useState(false);
  const [multipliers, setMultipliers] = useState<Record<number, number>>({});

  useEffect(() => {
    const loadSelections = async () => {
      try {
        const res = await apiFetch("/api/v1/weeklySelections");
        const data = await res.json();
        if (res.ok && data.meals.length > 0) {
          setMeals(data.meals);
          const mults: Record<number, number> = {};
          for (const m of data.meals) {
            if (m.servingSizeMultiplier !== 1) {
              mults[m.foodSelectionId] = m.servingSizeMultiplier;
            }
          }
          if (Object.keys(mults).length > 0) setMultipliers(mults);
        }
      } catch {}
    };
    loadSelections();
  }, []);

  const generateMeals = async (includeAll = false) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    setShowIncludeAll(false);
    try {
      const res = await apiFetch("/api/v1/chooseWeeklyMeals", {
        method: "POST",
        body: JSON.stringify({ count, includeAll }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate meals");
        return;
      }
      if (data.meals.length === 0) {
        setError("No eligible meals found. All meals have been chosen recently or are all displayed.");
        // Only offer retry if we haven't already tried including all meals
        if (!includeAll) {
          setShowIncludeAll(true);
        }
        return;
      }
      if (data.meals.length < count) {
        setInfo(`Only ${data.meals.length} eligible meal${data.meals.length === 1 ? "" : "s"} found — not enough meals available to fill your request.`);
        if (!includeAll) {
          setShowIncludeAll(true);
        }
      }
      setMeals((prev) => [...prev, ...data.meals]);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const rejectMeals = async (foodSelectionIds: number[]) => {
    setError(null);
    setInfo(null);
    setShowIncludeAll(false);
    try {
      const res = await apiFetch("/api/v1/rejectFoodSelections", {
        method: "POST",
        body: JSON.stringify({ foodSelectionIds }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to reject meals");
        return;
      }
      const rejected = new Set(foodSelectionIds);
      const remaining = meals.filter((m) => !rejected.has(m.foodSelectionId));
      setMeals(remaining);
    } catch {
      setError("Failed to connect to server");
    }
  };

  const generateIngredients = async () => {
    setGeneratingIngredients(true);
    setError(null);
    try {
      const mealIds = meals.map((m) => m.id);
      const res = await apiFetch("/api/v1/generateIngredients", {
        method: "POST",
        body: JSON.stringify({ mealIds, multipliers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate ingredients");
        return;
      }
      setIngredients(data.ingredients);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setGeneratingIngredients(false);
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev ? prev.filter((_, i) => i !== index) : null);
  };

  const updateIngredient = (index: number, updates: Partial<AggregatedIngredient>) => {
    setIngredients((prev) =>
      prev ? prev.map((ing, i) => (i === index ? { ...ing, ...updates } : ing)) : null
    );
  };

  return (
    <div className="app">
      <AppHeader title="🍽️ Meal Planner" onLogout={onLogout} />

      <div className="controls">
        <label htmlFor="count">Number of meals:</label>
        <input
          id="count"
          className="count-input"
          type="number"
          min={0}
          value={countInput}
          onChange={(e) => setCountInput(e.target.value)}
        />
        <button
          className="generate-button"
          onClick={() => generateMeals()}
          disabled={loading || count < 1}
        >
          {loading ? "Generating..." : "Generate Meals"}
        </button>
      </div>

      {error && (
        <div className="error-toast">
          <span>
            {error}
            {showIncludeAll && (
              <div>
                <a href="#" className="include-all-link" onClick={(e) => { e.preventDefault(); generateMeals(true); }}>
                  Include recently suggested meals
                </a>
              </div>
            )}
          </span>
          <button className="error-close" onClick={() => setError(null)}>x</button>
        </div>
      )}

      {info && (
        <div className="info-toast">
          <span>
            {info}
            {showIncludeAll && (
              <div>
                <a href="#" className="include-all-link" onClick={(e) => { e.preventDefault(); generateMeals(true); }}>
                  Include recently suggested meals
                </a>
              </div>
            )}
          </span>
          <button className="info-close" onClick={() => setInfo(null)}>x</button>
        </div>
      )}

      {meals.length > 0 && (
        <div>
          <div className="meals-header">
            <h2>This Week's Meals</h2>
            <button
              className="reject-button"
              onClick={() => rejectMeals(meals.map((m) => m.foodSelectionId))}
            >
              Reject All
            </button>
          </div>

          {meals.map((meal) => (
            <MealCard
              key={meal.foodSelectionId}
              meal={meal}
              multiplier={multipliers[meal.foodSelectionId] || 1}
              onReject={(id) => rejectMeals([id])}
              onMultiplierChange={(fsId, m) => { setMultipliers((prev) => ({ ...prev, [fsId]: m })); setIngredients(null); }}
            />
          ))}

          <button
            className="generate-button ingredients-button"
            onClick={generateIngredients}
            disabled={generatingIngredients || ingredients !== null}
          >
            {generatingIngredients ? "Generating..." : "Generate Ingredients"}
          </button>
        </div>
      )}

      {ingredients && (
        <div className="ingredients-section">
          <h2 className="ingredients-heading">Ingredients</h2>
          {ingredients.length === 0 ? (
            <p className="empty-state">No ingredients found for the selected meals.</p>
          ) : (
            <div className="ingredient-edit-list">
              {ingredients.map((ing, i) => (
                <div key={i} className="ingredient-edit-row">
                  <input
                    className="edit-input-sm"
                    type="number"
                    step="any"
                    min="0"
                    defaultValue={ing.quantity}
                    onBlur={(e) => updateIngredient(i, { quantity: Number(e.target.value) || 0 })}
                  />
                  <select
                    className="edit-select"
                    value={ing.measurementUnit}
                    onChange={(e) => updateIngredient(i, { measurementUnit: e.target.value as AggregatedIngredient["measurementUnit"] })}
                  >
                    {MEASUREMENT_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <span className="ingredient-name">{ing.name}{ing.optional && <span className="optional-tag"> (optional)</span>}</span>
                  <span className="ingredient-sources">({ing.sources.join(", ")})</span>
                  <button className="remove-ingredient" onClick={() => removeIngredient(i)}>x</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
