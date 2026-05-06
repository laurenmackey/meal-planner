import React, { useEffect, useState } from "react";
import { MealSelection } from "../../src/types";
import MealCard from "./components/MealCard";
import "./App.css";

const DEFAULT_COUNT = 3;

export default function App() {
  const [countInput, setCountInput] = useState(String(DEFAULT_COUNT));
  const count = countInput === "" ? 0 : Number(countInput);
  const [meals, setMeals] = useState<MealSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const loadExistingSelections = async () => {
      try {
        const res = await fetch("/api/v1/weeklySelections");
        const data = await res.json();
        if (res.ok && data.meals.length > 0) {
          setMeals(data.meals);
        }
      } catch {
        // Silently fail on initial load — user can still generate manually
      }
    };
    loadExistingSelections();
  }, []);

  const generateMeals = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/v1/chooseWeeklyMeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate meals");
        return;
      }
      if (data.meals.length === 0) {
        setError("No eligible meals found. All meals have been chosen recently.");
        return;
      }
      if (data.meals.length < count) {
        setInfo(`Only ${data.meals.length} eligible meal${data.meals.length === 1 ? "" : "s"} found — not enough meals available to fill your request.`);
      }
      setMeals((prev) => [...prev, ...data.meals]);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const rejectMeals = async (foodSelectionIds: number[]) => {
    try {
      const res = await fetch("/api/v1/rejectFoodSelections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="app">
      <h1 className="title">🍽️ Meal Planner</h1>

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
          onClick={generateMeals}
          disabled={loading || count < 1}
        >
          {loading ? "Generating..." : "Generate Meals"}
        </button>
      </div>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button className="error-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {info && (
        <div className="info-toast">
          <span>{info}</span>
          <button className="info-close" onClick={() => setInfo(null)}>×</button>
        </div>
      )}

      {meals.length > 0 && (
        <div>
          <div className="meals-header">
            <h2>Suggested Meals</h2>
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
              onReject={(id) => rejectMeals([id])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
