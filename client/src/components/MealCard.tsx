import React from "react";
import { MealSelection, SERVING_MULTIPLIERS } from "../../../src/types";

interface MealCardProps {
  meal: MealSelection;
  multiplier: number;
  onReject: (foodSelectionId: number) => void;
  onMultiplierChange: (foodSelectionId: number, multiplier: number) => void;
}

export default function MealCard({ meal, multiplier, onReject, onMultiplierChange }: MealCardProps) {
  return (
    <div className="meal-card">
      <div className="meal-card-content">
        <div>
          <h3 className="meal-name">{meal.name}</h3>
          {meal.description && <p className="meal-description">{meal.description}</p>}
          <div className="meal-stats">
            <span>Rating: {meal.rating}/10</span>
            {" · "}
            <span>Easiness: {meal.easinessScore}/10</span>
            {" · "}
            <span>Health: {meal.healthScore}/10</span>
            {meal.mainProtein && meal.mainProtein !== "none" && (
              <>{" · "}<span>Protein: {meal.mainProtein}</span></>
            )}
            {" · "}
            <span>Serves {meal.servingSize}</span>
          </div>
          <div className="meal-multiplier">
            <label>
              Quantity:
              <select
                className="multiplier-select"
                value={multiplier}
                onChange={(e) => onMultiplierChange(meal.foodSelectionId, Number(e.target.value))}
              >
                {SERVING_MULTIPLIERS.map((m) => (
                  <option key={m} value={m}>{m}x</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button
          className="reject-button meal-reject"
          onClick={() => onReject(meal.foodSelectionId)}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
