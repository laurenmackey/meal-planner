import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ParsedRecipe, ParsedIngredient, PROTEINS, MEASUREMENT_UNITS } from "../../../src/types";
import { apiFetch } from "../api";
import AppHeader from "./AppHeader";

export default function AddRecipePage({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [rating, setRating] = useState("5");
  const [easinessScore, setEasinessScore] = useState("5");
  const [healthScore, setHealthScore] = useState("5");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [pastedText, setPastedText] = useState("");

  const parseWithBody = async (body: Record<string, string>) => {
    setParsing(true);
    setError(null);
    setRecipe(null);
    setSaved(false);
    try {
      const res = await apiFetch("/api/v1/parseRecipe", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.details || data.error || "Failed to parse recipe";
        if (detail.includes("403") || detail.includes("Failed to fetch recipe page")) {
          setError("Could not fetch this URL automatically. Paste the recipe text below instead.");
          setShowPasteFallback(true);
        } else {
          setError(detail);
        }
        return;
      }
      setRecipe(data);
      setShowPasteFallback(false);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setParsing(false);
    }
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    await parseWithBody({ url });
  };

  const handleParsePasted = async () => {
    if (!pastedText.trim()) return;
    await parseWithBody({ url, text: pastedText });
  };

  const updateRecipe = (updates: Partial<ParsedRecipe>) => {
    if (!recipe) return;
    setRecipe({ ...recipe, ...updates });
  };

  const updateIngredient = (index: number, updates: Partial<ParsedIngredient>) => {
    if (!recipe) return;
    const ingredients = recipe.ingredients.map((ing, i) =>
      i === index ? { ...ing, ...updates } : ing
    );
    setRecipe({ ...recipe, ingredients });
  };

  const removeIngredient = (index: number) => {
    if (!recipe) return;
    setRecipe({ ...recipe, ingredients: recipe.ingredients.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (!recipe) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/v1/saveRecipe", {
        method: "POST",
        body: JSON.stringify({
          ...recipe,
          notes: notes || null,
          rating: Number(rating),
          easinessScore: Number(easinessScore),
          healthScore: Number(healthScore),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details || data.error || "Failed to save recipe");
        return;
      }
      setSaved(true);
      setRecipe(null);
      setUrl("");
      setNotes("");
      setRating("5");
      setEasinessScore("5");
      setHealthScore("5");
      setEditing(false);
      setShowPasteFallback(false);
      setPastedText("");
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <AppHeader title="Add Recipe" onLogout={onLogout} />

      <form className="parse-form" onSubmit={handleParse}>
        <input
          className="url-input"
          type="url"
          placeholder="Paste recipe URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button className="generate-button" type="submit" disabled={parsing || !url || !!recipe}>
          {parsing ? "Parsing..." : "Parse Recipe"}
        </button>
      </form>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button className="error-close" onClick={() => setError(null)}>x</button>
        </div>
      )}

      {showPasteFallback && !recipe && (
        <div className="paste-fallback">
          <textarea
            className="notes-input"
            placeholder="Copy the recipe text from the website and paste it here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={8}
          />
          <button
            className="generate-button"
            onClick={handleParsePasted}
            disabled={parsing || !pastedText.trim()}
          >
            {parsing ? "Parsing..." : "Parse Pasted Text"}
          </button>
        </div>
      )}

      {recipe && !saved && (
        <div className="parsed-recipe">
          {!editing ? (
            <>
              <div className="recipe-header-row">
                <h2 className="recipe-name">{recipe.name}</h2>
                <button className="back-button" onClick={() => setEditing(true)}>Edit</button>
              </div>
              {recipe.description && <p className="recipe-description">{recipe.description}</p>}
              <a href={recipe.url} target="_blank" rel="noopener noreferrer" className="recipe-link">
                View original recipe
              </a>

              <div className="recipe-meta">
                {recipe.sourceName && <span>Source: {recipe.sourceName}</span>}
                {recipe.mainProtein && recipe.mainProtein !== "none" && <span>Protein: {recipe.mainProtein}</span>}
                {recipe.prepTimeMinutes && <span>Prep: {recipe.prepTimeMinutes} min</span>}
                {recipe.cookTimeMinutes && <span>Cook: {recipe.cookTimeMinutes} min</span>}
                <span>Serves: {recipe.servingSize}</span>
              </div>

              <h3>Ingredients</h3>
              <ul className="ingredient-list">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.quantity} {ing.measurementUnit === "whole" ? "" : ing.measurementUnit}{" "}
                    {ing.name}
                    {ing.notes ? ` (${ing.notes})` : ""}
                    {ing.optional ? " - optional" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <div className="recipe-header-row">
                <h3>Edit Recipe</h3>
                <button className="back-button" onClick={() => setEditing(false)}>Done</button>
              </div>
              <a href={recipe.url} target="_blank" rel="noopener noreferrer" className="recipe-link">
                View original recipe
              </a>

              <div className="edit-section">
                <label>
                  Name
                  <input
                    className="edit-input"
                    value={recipe.name}
                    onChange={(e) => updateRecipe({ name: e.target.value })}
                  />
                </label>

                <label>
                  Description
                  <input
                    className="edit-input"
                    value={recipe.description || ""}
                    onChange={(e) => updateRecipe({ description: e.target.value || null })}
                  />
                </label>

                <label>
                  Source
                  <input
                    className="edit-input"
                    placeholder="e.g. NYT Cooking, Serious Eats..."
                    value={recipe.sourceName || ""}
                    onChange={(e) => updateRecipe({ sourceName: e.target.value || null })}
                  />
                </label>

                <div className="edit-row">
                  <label>
                    Protein
                    <select
                      className="edit-select"
                      value={recipe.mainProtein || "none"}
                      onChange={(e) => updateRecipe({ mainProtein: e.target.value as ParsedRecipe["mainProtein"] })}
                    >
                      {PROTEINS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Prep (min)
                    <input
                      className="edit-input-sm"
                      type="number"
                      min="0"
                      value={recipe.prepTimeMinutes ?? ""}
                      onChange={(e) => updateRecipe({ prepTimeMinutes: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                  <label>
                    Cook (min)
                    <input
                      className="edit-input-sm"
                      type="number"
                      min="0"
                      value={recipe.cookTimeMinutes ?? ""}
                      onChange={(e) => updateRecipe({ cookTimeMinutes: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                  <label>
                    Serves
                    <input
                      className="edit-input-sm"
                      type="number"
                      min="1"
                      value={recipe.servingSize}
                      onChange={(e) => updateRecipe({ servingSize: Number(e.target.value) })}
                    />
                  </label>
                </div>
              </div>

              <h3>Ingredients</h3>
              <div className="ingredient-edit-list">
                {recipe.ingredients.map((ing, i) => (
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
                    <input
                      className="edit-input"
                      placeholder="notes"
                      value={ing.notes || ""}
                      onChange={(e) => updateIngredient(i, { notes: e.target.value || null })}
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
                ))}
              </div>
            </>
          )}

          <div className="score-section">
            <h3>Rate this recipe</h3>
            <div className="score-inputs">
              <label>
                Rating (1-10)
                <input type="number" min="1" max="10" value={rating} onChange={(e) => setRating(e.target.value)} />
              </label>
              <label>
                Easiness (1-10)
                <input type="number" min="1" max="10" value={easinessScore} onChange={(e) => setEasinessScore(e.target.value)} />
              </label>
              <label>
                Health (1-10)
                <input type="number" min="1" max="10" value={healthScore} onChange={(e) => setHealthScore(e.target.value)} />
              </label>
            </div>
            <label>
              Notes
              <textarea
                className="notes-input"
                placeholder="Any notes about this recipe..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </label>
            <button className="generate-button save-button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Recipe"}
            </button>
          </div>
        </div>
      )}

      {saved && (
        <div className="save-success">
          Recipe saved! <a href="#" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Back to home</a>
        </div>
      )}
    </div>
  );
}
