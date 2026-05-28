import React from "react";
import { MealSelection, SERVING_MULTIPLIERS } from "../../../src/types";
import styles from "./MealCard.module.css";

interface MealCardProps {
  meal: MealSelection;
  multiplier: number;
  onReject: (foodSelectionId: number) => void;
  onMultiplierChange: (foodSelectionId: number, multiplier: number) => void;
}

export default function MealCard({ meal, multiplier, onReject, onMultiplierChange }: MealCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <div>
          <h3 className={styles.name}>
            {meal.name}
            {meal.isBasic && <span className={styles.basicBadge}>Basic</span>}
          </h3>
          {meal.description && <p className={styles.description}>{meal.description}</p>}
          {meal.notes && <p className={styles.notes}>{meal.notes}</p>}
          {meal.url && (
            <a href={meal.url} target="_blank" rel="noopener noreferrer" className="recipe-link">
              View Recipe
            </a>
          )}
          <div className={styles.stats}>
            <span>Rating: {meal.rating}/10</span>
            {" · "}
            <span>Easiness: {meal.easinessScore}/10</span>
            {" · "}
            <span>Health: {meal.healthScore}/10</span>
            {meal.mainProtein && meal.mainProtein !== "none" && (
              <>{" · "}<span>Protein: {meal.mainProtein}</span></>
            )}
            {" · "}
            <span>Serves {meal.servingSize * multiplier}</span>
          </div>
          <div className={styles.multiplier}>
            <label>
              Quantity:
              <select
                className={styles.multiplierSelect}
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
          className={styles.rejectButton}
          onClick={() => onReject(meal.foodSelectionId)}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
