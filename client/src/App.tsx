import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { MealSelection } from "../../src/types";
import MealCard from "./components/MealCard";
import AuthPage from "./components/AuthPage";
import AddRecipePage from "./components/AddRecipePage";
import { apiFetch } from "./api";
import "./App.css";

const DEFAULT_COUNT = 3;

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
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

  if (!authed) {
    return <AuthPage onAuth={() => setAuthed(true)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage onLogout={() => setAuthed(false)} />} />
      <Route path="/add-recipe" element={<AddRecipePage />} />
    </Routes>
  );
}

function HomePage({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [countInput, setCountInput] = useState(String(DEFAULT_COUNT));
  const count = countInput === "" ? 0 : Number(countInput);
  const [meals, setMeals] = useState<MealSelection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showIncludeAll, setShowIncludeAll] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const meRes = await apiFetch("/api/v1/me");
        if (meRes.ok) {
          const data = await meRes.json();
          setInviteCode(data.household.inviteCode);
        }
      } catch {}
      try {
        const res = await apiFetch("/api/v1/weeklySelections");
        const data = await res.json();
        if (res.ok && data.meals.length > 0) {
          setMeals(data.meals);
        }
      } catch {}
    };
    loadData();
  }, []);

  const handleLogout = async () => {
    await apiFetch("/api/v1/logout", { method: "POST" });
    onLogout(); // unmounts HomePage, so no need to clear local state
  };

  const generateMeals = async (includeAll = false) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    setShowIncludeAll(false);
    try {
      const res = await apiFetch("/api/v1/chooseWeeklyMeals", {
        method: "POST",
        body: JSON.stringify({ count, includeAll }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate meals");
        return;
      }
      if (data.meals.length === 0) {
        setError("No eligible meals found. All meals have been chosen recently or are all displayed.");
        // Only offer retry if we haven't already tried including all meals
        if (!includeAll) {
          setShowIncludeAll(true);
        }
        return;
      }
      if (data.meals.length < count) {
        setInfo(`Only ${data.meals.length} eligible meal${data.meals.length === 1 ? "" : "s"} found — not enough meals available to fill your request.`);
        if (!includeAll) {
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

  return (
    <div className="app">
      <div className="app-header">
        <h1 className="title">🍽️ Meal Planner</h1>
        <div className="menu-wrapper" ref={menuRef}>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
            <span className="menu-icon" />
            <span className="menu-icon" />
            <span className="menu-icon" />
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              <button onClick={() => { navigate("/add-recipe"); setMenuOpen(false); }}>Add Recipe</button>
              <button onClick={() => { setShowInviteCode(!showInviteCode); setMenuOpen(false); }}>
                {showInviteCode ? "Hide Invite Code" : "Show Invite Code"}
              </button>
              <button onClick={handleLogout}>Log Out</button>
            </div>
          )}
        </div>
      </div>

      {showInviteCode && inviteCode && (
        <div className="invite-code-banner">
          <span>Share this code with your household: <strong>{inviteCode}</strong></span>
          <button className="invite-close" onClick={() => setShowInviteCode(false)}>x</button>
        </div>
      )}

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
          onClick={() => generateMeals()}
          disabled={loading || count < 1}
        >
          {loading ? "Generating..." : "Generate Meals"}
        </button>
      </div>

      {error && (
        <div className="error-toast">
          <span>
            {error}
            {showIncludeAll && (
              <div>
                <a href="#" className="include-all-link" onClick={(e) => { e.preventDefault(); generateMeals(true); }}>
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
                <a href="#" className="include-all-link" onClick={(e) => { e.preventDefault(); generateMeals(true); }}>
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
