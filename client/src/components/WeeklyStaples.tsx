import React, { useEffect, useState } from "react";
import { StapleSelection, FoodStaple } from "../../../src/types";
import { apiFetch } from "../api";

export default function WeeklyStaples({ onError }: { onError: (msg: string) => void }) {
  const [staples, setStaples] = useState<StapleSelection[]>([]);
  const [totalStapleCount, setTotalStapleCount] = useState(0);
  const [allStaples, setAllStaples] = useState<FoodStaple[]>([]);
  const [stapleSearch, setStapleSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/api/v1/chooseWeeklyStaples", { method: "POST" });
        const data = await res.json();
        if (res.ok) {
          setStaples(data.staples);
          setTotalStapleCount(data.staples.length);
        }
      } catch {}
      try {
        const res = await apiFetch("/api/v1/allStaples");
        const data = await res.json();
        if (res.ok) setAllStaples(data.staples);
      } catch {}
    };
    load();
  }, []);

  const rejectStaple = async (foodSelectionId: number) => {
    try {
      const res = await apiFetch("/api/v1/rejectFoodSelections", {
        method: "POST",
        body: JSON.stringify({ foodSelectionIds: [foodSelectionId] }),
      });
      if (!res.ok) {
        const data = await res.json();
        onError(data.error || "Failed to reject staple");
        return;
      }
      setStaples((prev) => prev.filter((s) => s.foodSelectionId !== foodSelectionId));
    } catch {
      onError("Failed to connect to server");
    }
  };

  const addStapleToWeek = async (foodStapleId: number) => {
    try {
      const res = await apiFetch("/api/v1/addWeeklyStaple", {
        method: "POST",
        body: JSON.stringify({ foodStapleId }),
      });
      const data = await res.json();
      if (res.ok) {
        setStaples((prev) => [...prev, data.staple].sort((a, b) => a.name.localeCompare(b.name)));
        setStapleSearch("");
      }
    } catch {
      onError("Failed to connect to server");
    }
  };

  const restoreStaples = async () => {
    try {
      const res = await apiFetch("/api/v1/chooseWeeklyStaples", {
        method: "POST",
        body: JSON.stringify({ restore: true }),
      });
      const data = await res.json();
      if (res.ok) setStaples(data.staples);
    } catch {
      onError("Failed to connect to server");
    }
  };

  const activeStapleIds = new Set(staples.map((s) => s.id));
  const filteredStaples = stapleSearch.trim()
    ? allStaples.filter((s) =>
        s.name.toLowerCase().includes(stapleSearch.toLowerCase()) && !activeStapleIds.has(s.id)
      )
    : [];

  if (totalStapleCount === 0 && staples.length === 0) return null;

  return (
    <div className="staples-section">
      <div className="staples-header">
        <h2 className="staples-heading">Weekly Staples</h2>
        {staples.length < totalStapleCount && (
          <a href="#" className="restore-staples-link" onClick={(e) => { e.preventDefault(); restoreStaples(); }}>
            Restore removed
          </a>
        )}
      </div>
      <div className="staple-search-wrapper">
        <input
          className="staple-search-input"
          type="text"
          placeholder="Search staples to add..."
          value={stapleSearch}
          onChange={(e) => setStapleSearch(e.target.value)}
        />
        {filteredStaples.length > 0 && (
          <div className="staple-search-results">
            {filteredStaples.map((s) => (
              <button key={s.id} className="staple-search-result" onClick={() => addStapleToWeek(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="staple-list">
        {staples.map((staple) => (
          <div key={staple.foodSelectionId} className="staple-row">
            <span className="staple-name">{staple.name}</span>
            {staple.notes && <span className="staple-notes"> — {staple.notes}</span>}
            <button className="remove-staple" onClick={() => rejectStaple(staple.foodSelectionId)}>x</button>
          </div>
        ))}
      </div>
    </div>
  );
}
