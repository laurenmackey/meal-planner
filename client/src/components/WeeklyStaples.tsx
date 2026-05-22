import { useEffect, useState } from "react";
import { StapleSelection, FoodStaple } from "../../../src/types";
import { apiFetch } from "../api";
import styles from "./WeeklyStaples.module.css";

interface WeeklyStaplesProps {
  onError: (msg: string) => void;
  onStaplesChange: (staples: StapleSelection[]) => void;
}

export default function WeeklyStaples({ onError, onStaplesChange }: WeeklyStaplesProps) {
  const [staples, setStaples] = useState<StapleSelection[]>([]);
  const [totalStapleCount, setTotalStapleCount] = useState(0);
  const [allStaples, setAllStaples] = useState<FoodStaple[]>([]);
  const [stapleSearch, setStapleSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

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

  useEffect(() => {
    onStaplesChange(staples);
  }, [staples]);

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

  const createStaple = async (name: string) => {
    try {
      const res = await apiFetch("/api/v1/staples", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || "Failed to create staple");
        return;
      }
      setAllStaples((prev) => [...prev, data.staple].sort((a, b) => a.name.localeCompare(b.name)));
      // Also add to this week
      await addStapleToWeek(data.staple.id);
    } catch {
      onError("Failed to connect to server");
    }
  };

  const startEditing = (staple: StapleSelection) => {
    setEditingId(staple.id);
    setEditName(staple.name);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      const res = await apiFetch(`/api/v1/staples/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || "Failed to update staple");
        return;
      }
      setStaples((prev) => prev.map((s) => s.id === editingId ? { ...s, name: data.staple.name } : s));
      setAllStaples((prev) => prev.map((s) => s.id === editingId ? { ...s, name: data.staple.name } : s));
      setEditingId(null);
    } catch {
      onError("Failed to connect to server");
    }
  };

  const deleteStaple = async (stapleId: number) => {
    try {
      const res = await apiFetch(`/api/v1/staples/${stapleId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        onError(data.error || "Failed to delete staple");
        return;
      }
      setStaples((prev) => prev.filter((s) => s.id !== stapleId));
      setAllStaples((prev) => prev.filter((s) => s.id !== stapleId));
      setTotalStapleCount((prev) => prev - 1);
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
  const searchTrimmed = stapleSearch.trim().toLowerCase();
  const filteredStaples = searchTrimmed
    ? allStaples.filter((s) =>
        s.name.toLowerCase().includes(searchTrimmed) && !activeStapleIds.has(s.id)
      )
    : [];
  const showCreateOption = searchTrimmed
    && !allStaples.some((s) => s.name.toLowerCase() === searchTrimmed);

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Weekly Staples</h2>
        {staples.length < totalStapleCount && (
          <a href="#" className={styles.restoreLink} onClick={(e) => { e.preventDefault(); restoreStaples(); }}>
            Restore removed
          </a>
        )}
      </div>
      <div className={styles.searchWrapper}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search or create staples..."
          value={stapleSearch}
          onChange={(e) => setStapleSearch(e.target.value)}
        />
        {(filteredStaples.length > 0 || showCreateOption) && (
          <div className={styles.searchResults}>
            {filteredStaples.map((s) => (
              <button key={s.id} className={styles.searchResult} onClick={() => addStapleToWeek(s.id)}>
                {s.name}
              </button>
            ))}
            {showCreateOption && (
              <button
                className={`${styles.searchResult} ${styles.createOption}`}
                onClick={() => { createStaple(stapleSearch.trim()); setStapleSearch(""); }}
              >
                Create "{stapleSearch.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
      <div className={styles.list}>
        {staples.map((staple) => (
          <div key={staple.foodSelectionId} className={styles.row}>
            {editingId === staple.id ? (
              <div className={styles.editRow}>
                <input
                  className={styles.editInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
                  autoFocus
                />
                <button className={styles.saveButton} onClick={saveEdit}>Save</button>
                <button className={styles.removeButton} onClick={() => setEditingId(null)}>x</button>
              </div>
            ) : (
              <>
                <span className={styles.name} onClick={() => startEditing(staple)}>{staple.name}</span>
                {staple.notes && <span className={styles.stapleNotes}> — {staple.notes}</span>}
                <button className={styles.deleteButton} onClick={() => setDeleteConfirm({ id: staple.id, name: staple.name })} title="Delete staple permanently">🗑</button>
                <button className={styles.removeButton} onClick={() => rejectStaple(staple.foodSelectionId)} title="Remove from this week">x</button>
              </>
            )}
          </div>
        ))}
      </div>
      {deleteConfirm && (
        <div className={styles.overlay} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.dialogText}>
              Are you sure you want to permanently delete <strong>{deleteConfirm.name}</strong> from your list of Weekly Staples?
            </p>
            <p className={styles.dialogHint}>You can always create it again from the search bar.</p>
            <div className={styles.dialogButtons}>
              <button className={styles.dialogDelete} onClick={() => { deleteStaple(deleteConfirm.id); setDeleteConfirm(null); }}>
                Delete
              </button>
              <button className={styles.dialogCancel} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
