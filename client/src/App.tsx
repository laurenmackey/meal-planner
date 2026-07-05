import React, { useEffect, useState, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import { Meal, MealSelection, StapleSelection, AggregatedIngredient, MEASUREMENT_UNITS } from "../../src/types";
import MealCard from "./components/MealCard";
import AuthPage from "./components/AuthPage";
import GoogleSetupPage from "./components/GoogleSetupPage";
import MealHistoryPage from "./components/MealHistoryPage";
import RecipesPage from "./components/RecipesPage";
import SettingsPage from "./components/SettingsPage";
import AppHeader from "./components/AppHeader";
import WeeklyStaples from "./components/WeeklyStaples";
import GoogleCalendar from "./components/GoogleCalendar";
import { apiFetch } from "./api";
import "./App.css";
import styles from "./components/HomePage.module.css";

const DEFAULT_COUNT = "3";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [googleSetup, setGoogleSetup] = useState(false);

  useEffect(() => {
    // Check for Google setup redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_setup") === "true") {
      setGoogleSetup(true);
      setAuthed(false);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

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

  if (googleSetup) {
    return <GoogleSetupPage onComplete={() => window.location.reload()} />;
  }

  if (!authed) {
    return <AuthPage onAuth={() => setAuthed(true)} />;
  }

  const handleLogout = () => setAuthed(false);

  return (
    <Routes>
      <Route path="/" element={<HomePage onLogout={handleLogout} />} />
      <Route path="/recipes" element={<RecipesPage onLogout={handleLogout} />} />
      <Route path="/history" element={<MealHistoryPage onLogout={handleLogout} />} />
      <Route path="/settings" element={<SettingsPage onLogout={handleLogout} />} />
    </Routes>
  );
}

function HomePage({ onLogout }: { onLogout: () => void }) {
  const [countInput, setCountInput] = useState(DEFAULT_COUNT);
  const count = countInput === "" ? 0 : Number(countInput);
  const [meals, setMeals] = useState<MealSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showIncludeAll, setShowIncludeAll] = useState(false);
  const [ingredients, setIngredients] = useState<(AggregatedIngredient & { _key: number })[] | null>(null);
  const [generatingIngredients, setGeneratingIngredients] = useState(false);
  const ingredientKeyRef = useRef(0);
  const [multipliers, setMultipliers] = useState<Record<number, number>>({});
  const [isNextWeek, setIsNextWeek] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await apiFetch("/api/v1/household/settings");
        const data = await res.json();
        if (res.ok) setCountInput(String(data.settings.defaultMealCount));
      } catch {}
    };
    const loadSelections = async () => {
      try {
        const res = await apiFetch("/api/v1/weeklySelections");
        const data = await res.json();
        if (res.ok) {
          setIsNextWeek(!!data.isNextWeek);
        }
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
    loadSettings();
    loadSelections();
  }, []);

  const [shortfall, setShortfall] = useState(0);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [mealSearch, setMealSearch] = useState("");
  const [allMeals, setAllMeals] = useState<Meal[]>([]);
  const [addingMealId, setAddingMealId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openAddMeal = async () => {
    setShowAddMeal(true);
    setMealSearch("");
    if (allMeals.length === 0) {
      try {
        const res = await apiFetch("/api/v1/allMeals");
        const data = await res.json();
        if (res.ok) setAllMeals(data.meals.map((m: any) => m as Meal));
      } catch {}
    }
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const addMealToWeek = async (mealId: number) => {
    setAddingMealId(mealId);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/addMealToWeek", {
        method: "POST",
        body: JSON.stringify({ mealId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add meal");
        return;
      }
      setMeals((prev) => [...prev, data.meal]);
      setShowAddMeal(false);
      setMealSearch("");
    } catch {
      setError("Failed to connect to server");
    } finally {
      setAddingMealId(null);
    }
  };

  const generateMeals = async (includeAll = false) => {
    const requestCount = includeAll && shortfall > 0 ? shortfall : count;
    setLoading(true);
    setError(null);
    setInfo(null);
    setShowIncludeAll(false);
    setShortfall(0);
    try {
      const res = await apiFetch("/api/v1/chooseWeeklyMeals", {
        method: "POST",
        body: JSON.stringify({ count: requestCount, includeAll }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate meals");
        return;
      }
      if (data.meals.length === 0) {
        setError("No eligible meals found. All meals have been chosen recently or are all displayed.");
        if (!includeAll) {
          setShortfall(requestCount);
          setShowIncludeAll(true);
        }
        return;
      }
      if (data.meals.length < requestCount) {
        const remaining = requestCount - data.meals.length;
        setInfo(`Only ${data.meals.length} eligible meal${data.meals.length === 1 ? "" : "s"} found — not enough meals available to fill your request.`);
        if (!includeAll) {
          setShortfall(remaining);
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
      setIngredients(data.ingredients.map((ing: AggregatedIngredient) => ({ ...ing, _key: ++ingredientKeyRef.current })));
    } catch {
      setError("Failed to connect to server");
    } finally {
      setGeneratingIngredients(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const [currentStaples, setCurrentStaples] = useState<StapleSelection[]>([]);
  const [extraItems, setExtraItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");

  const copyListToClipboard = async () => {
    const lines: string[] = [];

    if (ingredients && ingredients.length > 0) {
      for (const ing of ingredients) {
        const unit = ing.measurementUnit === "whole" ? "" : ` ${ing.measurementUnit}`;
        const optional = ing.optional ? " (optional)" : "";
        const notes = ing.notes.length > 0 ? ` — ${ing.notes.join("; ")}` : "";
        lines.push(`${ing.quantity}${unit} ${ing.name}${optional}${notes}`);
      }
    }

    for (const item of extraItems) {
      lines.push(item);
    }

    for (const s of currentStaples) {
      lines.push(s.name);
    }

    const plainText = lines.join("\n");
    // Write both plain text and HTML so Google Keep on mobile splits into separate checkboxes
    const html = "<ul>" + lines.map((l) => `<li>${l}</li>`).join("") + "</ul>";
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
    } catch {
      // Fallback for browsers that don't support ClipboardItem
      await navigator.clipboard.writeText(plainText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev ? prev.filter((_, i) => i !== index) : null);
  };

  const updateIngredient = (index: number, updates: Partial<AggregatedIngredient>) => {
    setIngredients((prev) =>
      prev ? prev.map((ing, i) => (i === index ? { ...ing, ...updates } : ing)) : null
    );
  };

  const addExtraItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setExtraItems((prev) => [...prev, trimmed]);
    setNewItem("");
  };

  const removeExtraItem = (index: number) => {
    setExtraItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="app">
      <AppHeader title="🍽️ Meal Planner" onLogout={onLogout} />

      <div className={styles.controls}>
        <label htmlFor="count">Number of meals:</label>
        <input
          id="count"
          className={styles.countInput}
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
        <button className="back-button" onClick={openAddMeal}>
          + Add Specific Meal
        </button>
      </div>

      {showAddMeal && (
        <div className={styles.addMealDropdown}>
          <input
            ref={searchInputRef}
            className="edit-input"
            type="text"
            placeholder="Search meals..."
            value={mealSearch}
            onChange={(e) => setMealSearch(e.target.value)}
          />
          <div className={styles.addMealResults}>
            {allMeals
              .filter((m) => !m.isArchived && m.name.toLowerCase().includes(mealSearch.toLowerCase()))
              .filter((m) => !meals.some((s) => s.id === m.id))
              .slice(0, 10)
              .map((m) => (
                <button
                  key={m.id}
                  className={styles.addMealItem}
                  onClick={() => addMealToWeek(m.id)}
                  disabled={addingMealId === m.id}
                >
                  {m.name}
                  {m.mainProtein && m.mainProtein !== "none" && (
                    <span className={styles.addMealProtein}>{m.mainProtein}</span>
                  )}
                </button>
              ))}
            {allMeals.length > 0 && allMeals
              .filter((m) => !m.isArchived && m.name.toLowerCase().includes(mealSearch.toLowerCase()))
              .filter((m) => !meals.some((s) => s.id === m.id))
              .length === 0 && (
              <p className={styles.addMealEmpty}>No matching meals found</p>
            )}
          </div>
          <button className={styles.addMealCancel} onClick={() => setShowAddMeal(false)}>Cancel</button>
        </div>
      )}

      {error && (
        <div className="error-toast">
          <span>
            {error}
            {showIncludeAll && (
              <div>
                <a href="#" className={styles.includeAllLink} onClick={(e) => { e.preventDefault(); generateMeals(true); }}>
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
                <a href="#" className={styles.includeAllLink} onClick={(e) => { e.preventDefault(); generateMeals(true); }}>
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
          <div className={styles.mealsHeader}>
            <h2>{isNextWeek ? "Next Week's Meals" : "This Week's Meals"}</h2>
            <button
              className={styles.rejectButton}
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

          <div className="ingredients-buttons">
            <button
              className="generate-button ingredients-button"
              onClick={generateIngredients}
              disabled={generatingIngredients || ingredients !== null}
            >
              {generatingIngredients ? "Generating..." : "Generate Ingredients"}
            </button>
          </div>
        </div>
      )}

      {ingredients && (
        <div className={styles.ingredientsSection}>
          <h2 className={styles.ingredientsHeading}>Grocery List</h2>
          {ingredients.length === 0 ? (
            <p className="empty-state">No ingredients found for the selected meals.</p>
          ) : (
            <div className="ingredient-edit-list">
              {ingredients.map((ing, i) => (
                <div key={ing._key} className="ingredient-edit-row">
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
                  <input
                    className="edit-input"
                    value={[ing.name, ing.notes.length > 0 ? ing.notes.join("; ") : "", ing.optional ? "(optional)" : ""].filter(Boolean).join(" — ")}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const hasOptional = raw.includes("(optional)");
                      const cleaned = raw.replace(/\s*—?\s*\(optional\)/g, "");
                      const parts = cleaned.split(" — ");
                      updateIngredient(i, {
                        name: parts[0],
                        notes: parts.length > 1 ? [parts.slice(1).join(" — ")] : [],
                        optional: hasOptional,
                      });
                    }}
                  />
                  <button className="remove-ingredient" onClick={() => removeIngredient(i)}>x</button>
                </div>
              ))}
            </div>
          )}

          {extraItems.length > 0 && (
            <div className={styles.extraItems}>
              {extraItems.map((item, i) => (
                <div key={i} className="ingredient-edit-row">
                  <span className={styles.extraItemName}>{item}</span>
                  <button className="remove-ingredient" onClick={() => removeExtraItem(i)}>x</button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.addItemRow}>
            <input
              className="edit-input"
              placeholder="Add item to list..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addExtraItem(); }}
            />
            <button className="back-button" onClick={addExtraItem} disabled={!newItem.trim()}>Add</button>
          </div>

          <button
            className="generate-button copy-list-button"
            onClick={copyListToClipboard}
            style={{ marginTop: "16px" }}
          >
            {copied ? "Copied!" : currentStaples.length > 0 ? "Copy Grocery List (incl. staples)" : "Copy Grocery List"}
          </button>
        </div>
      )}
      <WeeklyStaples onError={setError} onStaplesChange={setCurrentStaples} />
      {meals.length > 0 && (
        <GoogleCalendar meals={meals} />
      )}
    </div>
  );
}
