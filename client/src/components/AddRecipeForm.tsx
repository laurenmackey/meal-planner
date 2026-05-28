import React, { useState } from "react";
import { ParsedRecipe, ParsedIngredient, PROTEINS, MEASUREMENT_UNITS } from "../../../src/types";
import { apiFetch } from "../api";
import styles from "./AddRecipeForm.module.css";

interface AddRecipeFormProps {
  onSaved: () => void;
}

const MAX_IMAGE_DIMENSION = 1568;

function resizeImage(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve({ data: base64, mediaType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function AddRecipeForm({ onSaved }: AddRecipeFormProps) {
  const [url, setUrl] = useState("");
  const [parsing, setParsing] = useState<"url" | "pasted" | "image" | false>(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [rating, setRating] = useState("5");
  const [easinessScore, setEasinessScore] = useState("5");
  const [healthScore, setHealthScore] = useState("5");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isBasic, setIsBasic] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const checkDuplicate = async (name: string) => {
    try {
      const res = await apiFetch(`/api/v1/checkRecipeName?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.exists) {
        setDuplicateWarning(`A recipe named "${data.matchedName}" already exists. If this is a different recipe, change the name before saving.`);
      } else {
        setDuplicateWarning(null);
      }
    } catch {}
  };

  const parseWithBody = async (body: Record<string, string>, source: "url" | "pasted") => {
    setParsing(source);
    setError(null);
    setRecipe(null);
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
      checkDuplicate(data.name);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setParsing(false);
    }
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    await parseWithBody({ url }, "url");
  };

  const handleParsePasted = async () => {
    if (!pastedText.trim()) return;
    await parseWithBody({ url, text: pastedText }, "pasted");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImageFiles(files);
  };

  const handleParseImages = async () => {
    if (imageFiles.length === 0) return;
    setParsing("image");
    setError(null);
    setRecipe(null);
    try {
      const images = await Promise.all(imageFiles.map(resizeImage));
      const res = await apiFetch("/api/v1/parseRecipeImage", {
        method: "POST",
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details || data.error || "Failed to parse recipe from image");
        return;
      }
      setRecipe(data);
      checkDuplicate(data.name);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setParsing(false);
    }
  };

  const updateRecipe = (updates: Partial<ParsedRecipe>) => {
    if (!recipe) return;
    setRecipe({ ...recipe, ...updates });
    if (updates.name !== undefined) {
      checkDuplicate(updates.name);
    }
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
          isBasic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details || data.error || "Failed to save recipe");
        return;
      }
      setRecipe(null);
      setUrl("");
      setNotes("");
      setRating("5");
      setEasinessScore("5");
      setHealthScore("5");
      setIsBasic(false);
      setEditing(false);
      setShowPasteFallback(false);
      setPastedText("");
      setImageFiles([]);
      setDuplicateWarning(null);
      onSaved();
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form className={styles.parseForm} onSubmit={handleParse}>
        <input
          className={styles.urlInput}
          type="url"
          placeholder="Paste recipe URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="generate-button" type="submit" disabled={!!parsing || !url || !!recipe}>
          {parsing === "url" ? "Parsing..." : "Parse URL"}
        </button>
      </form>

      <div className={styles.divider}><span>or</span></div>

      <div className={styles.imageUpload}>
        <label className={styles.imageLabel}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className={styles.imageInput}
            disabled={!!parsing || !!recipe}
          />
          <span className={styles.imageLabelText}>
            {imageFiles.length > 0
              ? `${imageFiles.length} photo${imageFiles.length > 1 ? "s" : ""} selected`
              : "Upload recipe photos"}
          </span>
        </label>
        {imageFiles.length > 0 && !recipe && (
          <button className="generate-button" onClick={handleParseImages} disabled={!!parsing}>
            {parsing === "image" ? "Parsing..." : "Parse from Photos"}
          </button>
        )}
      </div>

      <div className={styles.divider}><span>or</span></div>

      <button
        className={`back-button ${styles.manualButton}`}
        onClick={() => {
          setRecipe({
            name: "",
            url: "",
            sourceName: null,
            description: null,
            prepTimeMinutes: null,
            cookTimeMinutes: null,
            mainProtein: "none",
            servingSize: 4,
            ingredients: [],
          });
          setIsBasic(true);
          setEasinessScore("8");
          setEditing(true);
        }}
        disabled={!!parsing || !!recipe}
      >
        Add Manually
      </button>

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button className="error-close" onClick={() => setError(null)}>x</button>
        </div>
      )}

      {showPasteFallback && !recipe && (
        <div className={styles.pasteFallback}>
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
            disabled={!!parsing || !pastedText.trim()}
          >
            {parsing === "pasted" ? "Parsing..." : "Parse Pasted Text"}
          </button>
        </div>
      )}

      {recipe && (
        <div className={styles.parsedRecipe}>
          {duplicateWarning && (
            <div className={styles.duplicateWarning}>{duplicateWarning}</div>
          )}
          {!editing ? (
            <>
              <div className="recipe-header-row">
                <h2 className="recipe-name">{recipe.name}</h2>
                <button className="back-button" onClick={() => setEditing(true)}>Edit</button>
              </div>
              {recipe.description && <p className="recipe-description">{recipe.description}</p>}
              {recipe.url && (
                <a href={recipe.url} target="_blank" rel="noopener noreferrer" className="recipe-link">
                  View original recipe
                </a>
              )}

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
              {recipe.url && (
                <a href={recipe.url} target="_blank" rel="noopener noreferrer" className="recipe-link">
                  View original recipe
                </a>
              )}

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
                      key={recipe.servingSize}
                      defaultValue={recipe.servingSize}
                      onBlur={(e) => updateRecipe({ servingSize: Number(e.target.value) || 1 })}
                    />
                  </label>
                </div>
              </div>

              <h3>Ingredients</h3>
              <div className="ingredient-edit-list">
                {recipe.ingredients.map((ing, i) => (
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
              <button className="back-button" onClick={() => {
                if (!recipe) return;
                setRecipe({ ...recipe, ingredients: [...recipe.ingredients, { name: "", quantity: 1, measurementUnit: "whole", optional: false, notes: null }] });
              }} style={{ marginTop: "-18px" }}>
                + Add Ingredient
              </button>
            </>
          )}

          <div className={styles.scoreSection}>
            <h3>Rate this recipe</h3>
            <div className={styles.scoreInputs}>
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
            <label className={styles.basicCheck}>
              <input
                type="checkbox"
                checked={isBasic}
                onChange={(e) => setIsBasic(e.target.checked)}
              />
              Basic meal (simple recipe you cook from memory)
            </label>
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
            <button className={`${'generate-button'} ${styles.saveButton}`} onClick={handleSave} disabled={saving || !!duplicateWarning || !recipe?.name?.trim()}>
              {saving ? "Saving..." : "Save Recipe"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
