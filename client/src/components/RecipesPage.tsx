import React, { useEffect, useState } from "react";
import { Meal, ParsedIngredient, PROTEINS, Protein, MEASUREMENT_UNITS } from "../../../src/types";
import { apiFetch } from "../api";
import AppHeader from "./AppHeader";
import AddRecipeForm from "./AddRecipeForm";
import styles from "./RecipesPage.module.css";

interface MealWithIngredients extends Meal {
  ingredients: ParsedIngredient[];
}

export default function RecipesPage({ onLogout }: { onLogout: () => void }) {
  const [meals, setMeals] = useState<MealWithIngredients[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMeals, setExpandedMeals] = useState<Set<number>>(new Set());
  const [editingMeal, setEditingMeal] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<Meal>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIngredients, setEditingIngredients] = useState<number | null>(null);
  const [editIngredientValues, setEditIngredientValues] = useState<ParsedIngredient[]>([]);
  const [showAddRecipe, setShowAddRecipe] = useState(false);

  const loadMeals = async () => {
    try {
      const res = await apiFetch("/api/v1/allMeals");
      const data = await res.json();
      if (res.ok) setMeals(data.meals);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadMeals();
  }, []);

  const toggleMeal = (id: number) => {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEditing = (meal: MealWithIngredients) => {
    setEditingMeal(meal.id);
    setEditValues({
      name: meal.name,
      description: meal.description,
      notes: meal.notes,
      url: meal.url,
      sourceName: meal.sourceName,
      prepTimeMinutes: meal.prepTimeMinutes,
      cookTimeMinutes: meal.cookTimeMinutes,
      mainProtein: meal.mainProtein,
      rating: meal.rating,
      easinessScore: meal.easinessScore,
      healthScore: meal.healthScore,
      servingSize: meal.servingSize,
      isBasic: meal.isBasic,
    });
  };

  const saveEdits = async (mealId: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/meals/${mealId}`, {
        method: "PATCH",
        body: JSON.stringify(editValues),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      setMeals((prev) =>
        prev.map((m) => (m.id === mealId ? { ...m, ...data.meal } : m))
      );
      setEditingMeal(null);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  };

  const startEditingIngredients = (meal: MealWithIngredients) => {
    setEditingIngredients(meal.id);
    setEditIngredientValues(meal.ingredients.map((ing) => ({ ...ing })));
  };

  const updateIngredient = (index: number, updates: Partial<ParsedIngredient>) => {
    setEditIngredientValues((prev) =>
      prev.map((ing, i) => (i === index ? { ...ing, ...updates } : ing))
    );
  };

  const removeIngredient = (index: number) => {
    setEditIngredientValues((prev) => prev.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    setEditIngredientValues((prev) => [
      ...prev,
      { name: "", quantity: 1, measurementUnit: "whole", optional: false, notes: null },
    ]);
  };

  const saveIngredients = async (mealId: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/meals/${mealId}/ingredients`, {
        method: "PUT",
        body: JSON.stringify({ ingredients: editIngredientValues }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save ingredients");
        return;
      }
      setMeals((prev) =>
        prev.map((m) => (m.id === mealId ? { ...m, ingredients: data.ingredients } : m))
      );
      setEditingIngredients(null);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (meal: MealWithIngredients) => {
    try {
      const res = await apiFetch(`/api/v1/meals/${meal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isArchived: !meal.isArchived }),
      });
      const data = await res.json();
      if (res.ok) {
        setMeals((prev) => prev.map((m) => (m.id === meal.id ? { ...m, ...data.meal } : m)));
      }
    } catch {}
  };

  const activeMeals = meals.filter((m) => !m.isArchived);
  const archivedMeals = meals.filter((m) => m.isArchived);

  // Group active meals by protein
  const grouped: Record<string, MealWithIngredients[]> = {};
  for (const meal of activeMeals) {
    const protein = meal.mainProtein || "none";
    if (!grouped[protein]) grouped[protein] = [];
    grouped[protein].push(meal);
  }

  // Sort protein groups: known proteins first (in PROTEINS order), then "none"
  const sortedProteins = PROTEINS.filter((p) => grouped[p]);

  return (
    <div className="app">
      <AppHeader title="Recipes" onLogout={onLogout} />

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button className="error-close" onClick={() => setError(null)}>x</button>
        </div>
      )}

      <div className={showAddRecipe ? styles.addRecipeToggleActive : styles.addRecipeToggle}>
        <button className="generate-button" onClick={() => setShowAddRecipe(!showAddRecipe)}>
          {showAddRecipe ? "Cancel" : "Add Recipe"}
        </button>
      </div>

      {showAddRecipe && (
        <div className={styles.addRecipeSection}>
          <AddRecipeForm onSaved={() => { setShowAddRecipe(false); loadMeals(); }} />
        </div>
      )}

      {loading && <p>Loading...</p>}

      {!loading && meals.length === 0 && (
        <p className="empty-state">No recipes yet.</p>
      )}

      {sortedProteins.map((protein) => (
        <div key={protein} className={styles.proteinGroup}>
          <h2 className={styles.proteinHeading}>
            {protein === "none" ? "No Protein" : protein.charAt(0).toUpperCase() + protein.slice(1)}
            <span className={styles.proteinCount}> ({grouped[protein].length})</span>
          </h2>

          {grouped[protein].map((meal) => {
            const expanded = expandedMeals.has(meal.id);
            const isEditing = editingMeal === meal.id;
            const isEditingIngs = editingIngredients === meal.id;

            return (
              <div key={meal.id} className={styles.item}>
                <div className={styles.itemHeader} onClick={() => toggleMeal(meal.id)}>
                  <span className={`caret ${expanded ? "caret-open" : ""}`}>&#9654;</span>
                  <span className={styles.itemName}>
                    {meal.name}
                    {meal.isBasic && <span className={styles.basicBadge}>Basic</span>}
                  </span>
                </div>

                {expanded && (
                  <div className={styles.itemBody}>
                    <span className={styles.itemMeta}>
                      Rating: {meal.rating} | Ease: {meal.easinessScore} | Health: {meal.healthScore}
                    </span>
                    {!isEditing ? (
                      <>
                        {meal.url && (
                          <a href={meal.url} target="_blank" rel="noopener noreferrer" className="recipe-link">
                            View Recipe
                          </a>
                        )}
                        {meal.description && <p className="recipe-description">{meal.description}</p>}
                        <div className="recipe-meta">
                          {meal.sourceName && <span>Source: {meal.sourceName}</span>}
                          {meal.prepTimeMinutes && <span>Prep: {meal.prepTimeMinutes} min</span>}
                          {meal.cookTimeMinutes && <span>Cook: {meal.cookTimeMinutes} min</span>}
                          <span>Serves: {meal.servingSize}</span>
                        </div>
                        {meal.notes && <p className={styles.notes}>Notes: {meal.notes}</p>}

                        {!isEditingIngs ? (
                          <>
                            {meal.ingredients.length > 0 && (
                              <>
                                <h4 className={styles.ingredientsHeading}>Ingredients</h4>
                                <ul className="ingredient-list">
                                  {meal.ingredients.map((ing, i) => (
                                    <li key={i}>
                                      {ing.quantity} {ing.measurementUnit === "whole" ? "" : ing.measurementUnit}{" "}
                                      {ing.name}
                                      {ing.notes ? ` (${ing.notes})` : ""}
                                      {ing.optional ? " - optional" : ""}
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}

                            <div className={`ingredients-buttons ${styles.editButtons}`}>
                              <button className="back-button" onClick={() => startEditing(meal)}>
                                Edit Meal
                              </button>
                              <button className="back-button" onClick={() => startEditingIngredients(meal)}>
                                Edit Ingredients
                              </button>
                              <button className={styles.archiveButton} onClick={() => toggleArchive(meal)}>
                                {meal.isArchived ? "Unarchive" : "Archive"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="edit-section">
                            <h4 className={styles.ingredientsHeading}>Edit Ingredients</h4>
                            <div className="ingredient-edit-list">
                              {editIngredientValues.map((ing, i) => (
                                <div key={i} className="ingredient-edit-item">
                                  <div className="ingredient-edit-row">
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
                                      onChange={(e) => updateIngredient(i, { measurementUnit: e.target.value as ParsedIngredient["measurementUnit"] })}
                                    >
                                      {MEASUREMENT_UNITS.map((u) => (
                                        <option key={u} value={u}>{u}</option>
                                      ))}
                                    </select>
                                    <input
                                      className="edit-input"
                                      value={ing.name}
                                      onChange={(e) => updateIngredient(i, { name: e.target.value })}
                                    />
                                    <label className="optional-check">
                                      <input
                                        type="checkbox"
                                        checked={ing.optional}
                                        onChange={(e) => updateIngredient(i, { optional: e.target.checked })}
                                      />
                                      opt
                                    </label>
                                    <button className="remove-ingredient" onClick={() => removeIngredient(i)}>x</button>
                                  </div>
                                  <input
                                    className="edit-input ingredient-notes-input"
                                    placeholder="notes"
                                    value={ing.notes || ""}
                                    onChange={(e) => updateIngredient(i, { notes: e.target.value || null })}
                                  />
                                </div>
                              ))}
                            </div>
                            <button className="back-button" onClick={addIngredient} style={{ marginTop: "0.5rem" }}>
                              + Add Ingredient
                            </button>
                            <div className="ingredients-buttons">
                              <button className="generate-button" onClick={() => saveIngredients(meal.id)} disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                              </button>
                              <button className="back-button" onClick={() => setEditingIngredients(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="edit-section">
                        <label>
                          Name
                          <input className="edit-input" value={editValues.name || ""} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
                        </label>
                        <label>
                          Description
                          <input className="edit-input" value={editValues.description || ""} onChange={(e) => setEditValues({ ...editValues, description: e.target.value || null })} />
                        </label>
                        <label>
                          Notes
                          <textarea className="notes-input" value={editValues.notes || ""} onChange={(e) => setEditValues({ ...editValues, notes: e.target.value || null })} rows={2} />
                        </label>
                        <label>
                          URL
                          <input className="edit-input" value={editValues.url || ""} onChange={(e) => setEditValues({ ...editValues, url: e.target.value || null })} />
                        </label>
                        <label>
                          Source
                          <input className="edit-input" value={editValues.sourceName || ""} onChange={(e) => setEditValues({ ...editValues, sourceName: e.target.value || null })} />
                        </label>
                        <div className="edit-row">
                          <label>
                            Protein
                            <select className="edit-select" value={editValues.mainProtein || "none"} onChange={(e) => setEditValues({ ...editValues, mainProtein: e.target.value as Protein })}>
                              {PROTEINS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </label>
                          <label>
                            Prep (min)
                            <input className="edit-input-sm" type="number" min="0" value={editValues.prepTimeMinutes ?? ""} onChange={(e) => setEditValues({ ...editValues, prepTimeMinutes: e.target.value ? Number(e.target.value) : null })} />
                          </label>
                          <label>
                            Cook (min)
                            <input className="edit-input-sm" type="number" min="0" value={editValues.cookTimeMinutes ?? ""} onChange={(e) => setEditValues({ ...editValues, cookTimeMinutes: e.target.value ? Number(e.target.value) : null })} />
                          </label>
                          <label>
                            Serves
                            <input className="edit-input-sm" type="number" min="1" key={editValues.servingSize} defaultValue={editValues.servingSize ?? ""} onBlur={(e) => setEditValues({ ...editValues, servingSize: Number(e.target.value) || 1 })} />
                          </label>
                        </div>
                        <div className="edit-row">
                          <label>
                            Rating
                            <input className="edit-input-sm" type="number" min="1" max="10" value={editValues.rating ?? ""} onChange={(e) => setEditValues({ ...editValues, rating: Number(e.target.value) })} />
                          </label>
                          <label>
                            Easiness
                            <input className="edit-input-sm" type="number" min="1" max="10" value={editValues.easinessScore ?? ""} onChange={(e) => setEditValues({ ...editValues, easinessScore: Number(e.target.value) })} />
                          </label>
                          <label>
                            Health
                            <input className="edit-input-sm" type="number" min="1" max="10" value={editValues.healthScore ?? ""} onChange={(e) => setEditValues({ ...editValues, healthScore: Number(e.target.value) })} />
                          </label>
                        </div>
                        <label className={styles.basicCheck}>
                          <input
                            type="checkbox"
                            checked={editValues.isBasic || false}
                            onChange={(e) => setEditValues({ ...editValues, isBasic: e.target.checked })}
                          />
                          Basic meal
                        </label>
                        <div className="ingredients-buttons">
                          <button className="generate-button" onClick={() => saveEdits(meal.id)} disabled={saving}>
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button className="back-button" onClick={() => setEditingMeal(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {archivedMeals.length > 0 && (
        <div className={styles.archivedSection}>
          <h2 className={styles.proteinHeading}>
            Archived
            <span className={styles.proteinCount}> ({archivedMeals.length})</span>
          </h2>
          {archivedMeals.map((meal) => (
            <div key={meal.id} className={styles.item}>
              <div className={styles.itemHeader} onClick={() => toggleMeal(meal.id)}>
                <span className={`caret ${expandedMeals.has(meal.id) ? "caret-open" : ""}`}>&#9654;</span>
                <span className={styles.itemName}>{meal.name}</span>
              </div>
              {expandedMeals.has(meal.id) && (
                <div className={styles.itemBody}>
                  <span className={styles.itemMeta}>
                    Rating: {meal.rating} | Ease: {meal.easinessScore} | Health: {meal.healthScore}
                  </span>
                  {meal.description && <p className="recipe-description">{meal.description}</p>}
                  <div className={`ingredients-buttons ${styles.editButtons}`}>
                    <button className={styles.archiveButton} onClick={() => toggleArchive(meal)}>
                      Unarchive
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
