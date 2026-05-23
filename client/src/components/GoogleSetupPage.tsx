import React, { useState } from "react";
import { apiFetch } from "../api";
import styles from "./AuthPage.module.css";

interface GoogleSetupPageProps {
  onComplete: () => void;
}

export default function GoogleSetupPage({ onComplete }: GoogleSetupPageProps) {
  const [useInviteCode, setUseInviteCode] = useState(false);
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const body: Record<string, string> = {};
    if (useInviteCode) {
      body.inviteCode = inviteCode;
    } else {
      body.householdName = householdName;
    }

    try {
      const res = await apiFetch("/api/v1/auth/google/complete", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      onComplete();
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className="title">Almost there!</h1>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
        Set up your household to get started.
      </p>
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.tab} ${!useInviteCode ? styles.tabActive : ""}`}
            onClick={() => setUseInviteCode(false)}
          >
            Create household
          </button>
          <button
            type="button"
            className={`${styles.tab} ${useInviteCode ? styles.tabActive : ""}`}
            onClick={() => setUseInviteCode(true)}
          >
            Join household
          </button>
        </div>

        {useInviteCode ? (
          <>
            <label htmlFor="inviteCode">Invite code</label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="e.g. a3f8b2c1"
              required
            />
          </>
        ) : (
          <>
            <label htmlFor="householdName">Household name</label>
            <input
              id="householdName"
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="e.g. Mackey Family"
              required
            />
          </>
        )}

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Please wait..." : "Get Started"}
        </button>
      </form>
    </div>
  );
}
