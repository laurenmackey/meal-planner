import React, { useEffect, useState } from "react";
import { MealSelection } from "../../../src/types";
import { apiFetch } from "../api";
import AppHeader from "./AppHeader";
import styles from "./MealHistoryPage.module.css";

interface WeekGroup {
  weekStart: string;
  meals: MealSelection[];
}

export default function MealHistoryPage({ onLogout }: { onLogout: () => void }) {
  const [weeks, setWeeks] = useState<WeekGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await apiFetch("/api/v1/mealHistory");
        const data = await res.json();
        if (res.ok) {
          setWeeks(data.weeks);
        }
      } catch {}
      setLoading(false);
    };
    loadHistory();
  }, []);

  const toggleWeek = (weekStart: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekStart)) {
        next.delete(weekStart);
      } else {
        next.add(weekStart);
      }
      return next;
    });
  };

  const formatWeekLabel = (weekStart: string) => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts, )}`;
  };

  return (
    <div className="app">
      <AppHeader title="Meal History" onLogout={onLogout} />

      {loading && <p>Loading...</p>}

      {!loading && weeks.length === 0 && (
        <p className="empty-state">No meal history yet.</p>
      )}

      {weeks.map((week, i) => {
        const year = new Date(week.weekStart).getFullYear();
        const prevYear = i > 0 ? new Date(weeks[i - 1].weekStart).getFullYear() : null;
        const showYear = i === 0 || year !== prevYear;
        const expanded = expandedWeeks.has(week.weekStart);
        return (
          <React.Fragment key={week.weekStart}>
            {showYear && <h2 className={styles.year}>{year}</h2>}
            <div className={styles.week}>
              <button className={styles.weekHeader} onClick={() => toggleWeek(week.weekStart)}>
                <span className={`caret ${expanded ? "caret-open" : ""}`}>&#9654;</span>
                <span className={styles.weekLabel}>{formatWeekLabel(week.weekStart)}</span>
                <span className={styles.weekCount}>{week.meals.length} meal{week.meals.length !== 1 ? "s" : ""}</span>
              </button>
              {expanded && (
                <ul className={styles.mealList}>
                  {week.meals.map((meal) => (
                    <li key={meal.foodSelectionId} className={styles.mealItem}>
                      <strong>{meal.name}</strong>
                      {meal.servingSizeMultiplier > 1 && (
                        <span className={styles.mealMultiplier}> ({meal.servingSizeMultiplier}x)</span>
                      )}
                      {meal.description && <span className={styles.mealDesc}> — {meal.description}</span>}
                      {meal.url && (
                        <a href={meal.url} target="_blank" rel="noopener noreferrer" className={styles.mealLink}>
                          View recipe
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
