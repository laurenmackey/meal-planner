import React from "react";
import { MealSelection } from "../../../src/types";

interface MealCardProps {
  meal: MealSelection;
  onReject: (foodSelectionId: number) => void;
}

export default function MealCard({ meal, onReject }: MealCardProps) {
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
