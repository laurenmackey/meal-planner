import React, { useState } from "react";
import { apiFetch } from "../api";
import styles from "./AuthPage.module.css";

interface AuthPageProps {
  onAuth: () => void;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [useInviteCode, setUseInviteCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = isLogin ? "/api/v1/login" : "/api/v1/signup";
    const body: Record<string, string> = { email, password };
    if (!isLogin) {
      if (useInviteCode) {
        body.inviteCode = inviteCode;
      } else {
        body.householdName = householdName;
      }
    }

    try {
      const res = await apiFetch(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      // Full page reload clears 1Password's "save credentials" prompt
      window.location.reload();
    } catch {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className="title">🍽️ Meal Planner</h1>
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />

        {!isLogin && (
          <>
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
          </>
        )}

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Log In" : "Sign Up"}
        </button>

        <p className={styles.switch}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setIsLogin(!isLogin);
              setError(null);
            }}
          >
            {isLogin ? "Sign up" : "Log in"}
          </a>
        </p>
      </form>
    </div>
  );
}
