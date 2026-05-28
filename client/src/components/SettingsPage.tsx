import { useEffect, useState } from "react";
import { HouseholdSettings, PROTEINS, Protein } from "../../../src/types";
import { apiFetch } from "../api";
import AppHeader from "./AppHeader";
import styles from "./SettingsPage.module.css";

interface DraftSettings {
  lookbackWeeks: string;
  ratingWeight: string;
  easinessWeight: string;
  healthWeight: string;
  defaultMealCount: string;
  basicMealCount: string;
  preferredProteins: Protein[];
}

function toDraft(s: HouseholdSettings): DraftSettings {
  return {
    lookbackWeeks: String(s.lookbackWeeks),
    ratingWeight: String(s.ratingWeight),
    easinessWeight: String(s.easinessWeight),
    healthWeight: String(s.healthWeight),
    defaultMealCount: String(s.defaultMealCount),
    basicMealCount: String(s.basicMealCount),
    preferredProteins: [...s.preferredProteins],
  };
}

function fromDraft(d: DraftSettings): HouseholdSettings {
  return {
    lookbackWeeks: Number(d.lookbackWeeks) || 1,
    ratingWeight: Number(d.ratingWeight) || 0,
    easinessWeight: Number(d.easinessWeight) || 0,
    healthWeight: Number(d.healthWeight) || 0,
    defaultMealCount: Number(d.defaultMealCount) || 1,
    basicMealCount: Number(d.basicMealCount) || 0,
    preferredProteins: d.preferredProteins,
  };
}

export default function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [settings, setSettings] = useState<HouseholdSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftSettings | null>(null);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/api/v1/household/settings");
        const data = await res.json();
        if (res.ok) {
          setHouseholdName(data.name);
          setInviteCode(data.inviteCode);
          setSettings(data.settings);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const startEditing = () => {
    if (!settings) return;
    setDraft(toDraft(settings));
    setDraftName(householdName);
    setEditing(true);
    setError(null);
    setSuccess(false);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = { ...fromDraft(draft), name: draftName };
      const res = await apiFetch("/api/v1/household/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save settings");
        return;
      }
      setSettings(data.settings);
      if (data.name) setHouseholdName(data.name);
      setEditing(false);
      setDraft(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch {
      setError("Failed to connect to server");
    } finally {
      setSaving(false);
    }
  };

  const toggleProtein = (protein: Protein) => {
    if (!draft) return;
    const current = draft.preferredProteins;
    const updated = current.includes(protein)
      ? current.filter((p) => p !== protein)
      : [...current, protein];
    setDraft({ ...draft, preferredProteins: updated });
  };

  if (loading) return <div className="app"><AppHeader title="Settings" onLogout={onLogout} /><p>Loading...</p></div>;
  if (!settings) return <div className="app"><AppHeader title="Settings" onLogout={onLogout} /><p>Failed to load settings.</p></div>;

  const displaySettings = editing && draft ? draft : toDraft(settings);

  return (
    <div className="app">
      <AppHeader title="Settings" onLogout={onLogout} />

      {error && (
        <div className="error-toast">
          <span>{error}</span>
          <button className="error-close" onClick={() => setError(null)}>x</button>
        </div>
      )}

      {success && (
        <div className="info-toast">
          <span>Settings saved!</span>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.heading}>Household</h2>
        <div className={styles.field}>
          <span className={styles.label}>Name</span>
          {editing ? (
            <input
              id="household-name"
              className="edit-input"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          ) : (
            <span className={styles.value}>{householdName}</span>
          )}
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Invite Code</span>
          <span className={styles.value}><strong>{inviteCode}</strong></span>
        </div>
        <p className={styles.hint}>Share this code with household members so they can join.</p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.heading}>Meal Selection</h2>

        <div className={styles.field}>
          <span className={styles.label}>Default Meal Count <span className={styles.info} data-tip="How many meals are chosen per week">i</span></span>
          {editing ? (
            <input
              id="default-count"
              className="edit-input-sm"
              type="number"
              min="1"
              max="10"
              value={displaySettings.defaultMealCount}
              onChange={(e) => setDraft({ ...draft!, defaultMealCount: e.target.value })}
            />
          ) : (
            <span className={styles.value}>{settings.defaultMealCount}</span>
          )}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Basic Meal Count <span className={styles.info} data-tip="How many of the weekly meals should be basic (simple, from-memory) recipes. Lookback weeks does not apply to basic meals.">i</span></span>
          {editing ? (
            <input
              id="basic-count"
              className="edit-input-sm"
              type="number"
              min="0"
              max="10"
              value={displaySettings.basicMealCount}
              onChange={(e) => setDraft({ ...draft!, basicMealCount: e.target.value })}
            />
          ) : (
            <span className={styles.value}>{settings.basicMealCount}</span>
          )}
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Lookback Weeks <span className={styles.info} data-tip="How long to avoid repeating recently chosen meals. Does not apply to basic meals.">i</span></span>
          {editing ? (
            <input
              id="lookback"
              className="edit-input-sm"
              type="number"
              min="1"
              max="12"
              value={displaySettings.lookbackWeeks}
              onChange={(e) => setDraft({ ...draft!, lookbackWeeks: e.target.value })}
            />
          ) : (
            <span className={styles.value}>{settings.lookbackWeeks}</span>
          )}
        </div>

        <h3 className={styles.subheading}>Score Weights <span className={styles.info} data-tip="How much each factor contributes to a meal's selection score (0 to 1)">i</span></h3>

        <div className={styles.field}>
          <span className={styles.label}>Rating</span>
          {editing ? (
            <input
              id="rating-weight"
              className="edit-input-sm"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={displaySettings.ratingWeight}
              onChange={(e) => setDraft({ ...draft!, ratingWeight: e.target.value })}
            />
          ) : (
            <span className={styles.value}>{settings.ratingWeight}</span>
          )}
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Easiness</span>
          {editing ? (
            <input
              id="easiness-weight"
              className="edit-input-sm"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={displaySettings.easinessWeight}
              onChange={(e) => setDraft({ ...draft!, easinessWeight: e.target.value })}
            />
          ) : (
            <span className={styles.value}>{settings.easinessWeight}</span>
          )}
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Health</span>
          {editing ? (
            <input
              id="health-weight"
              className="edit-input-sm"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={displaySettings.healthWeight}
              onChange={(e) => setDraft({ ...draft!, healthWeight: e.target.value })}
            />
          ) : (
            <span className={styles.value}>{settings.healthWeight}</span>
          )}
        </div>

        <h3 className={styles.subheading}>Preferred Proteins <span className={styles.info} data-tip="Meals with these proteins get a scoring bonus">i</span></h3>
        {editing ? (
          <div className={styles.proteins}>
            {PROTEINS.filter((p) => p !== "none" && p !== "other").map((protein) => (
              <label key={protein} className={styles.proteinCheck}>
                <input
                  type="checkbox"
                  checked={displaySettings.preferredProteins.includes(protein)}
                  onChange={() => toggleProtein(protein)}
                />
                {protein.charAt(0).toUpperCase() + protein.slice(1)}
              </label>
            ))}
          </div>
        ) : (
          <p className={styles.proteinList}>
            {settings.preferredProteins.length > 0
              ? settings.preferredProteins.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")
              : "None"}
          </p>
        )}
      </div>

      <div className="ingredients-buttons">
        {editing ? (
          <>
            <button className="generate-button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button className="back-button" onClick={cancelEditing}>Cancel</button>
          </>
        ) : (
          <button className="generate-button" onClick={startEditing}>Edit</button>
        )}
      </div>
    </div>
  );
}
