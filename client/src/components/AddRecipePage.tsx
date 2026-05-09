import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ParsedRecipe } from "../../../src/types";
import { apiFetch } from "../api";

export default function AddRecipePage() {
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
  const [saved, setSaved] = useState(false);

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    setParsing(true);
    setError(null);
    setRecipe(null);
    setSaved(false);
    try {
      const res = await apiFetch("/api/v1/parseRecipe", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to parse recipe");
        return;
      }
      setRecipe(data);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setParsing(false);
    }
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
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="title">Add Recipe</h1>
        <button className="back-button" onClick={() => navigate("/")}>
          Back
        </button>
      </div>

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

      {recipe && (
        <div className="parsed-recipe">
          <h2 className="recipe-name">{recipe.name}</h2>
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

          {!saved ? (
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
          ) : (
            <div className="save-success">
              Recipe saved! <a href="#" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Back to home</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
