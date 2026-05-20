import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

interface AppHeaderProps {
  title: string;
  onLogout: () => void;
}

export default function AppHeader({ title, onLogout }: AppHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    const loadInviteCode = async () => {
      try {
        const res = await apiFetch("/api/v1/me");
        if (res.ok) {
          const data = await res.json();
          setInviteCode(data.household.inviteCode);
        }
      } catch {}
    };
    loadInviteCode();
  }, []);

  const handleLogout = async () => {
    await apiFetch("/api/v1/logout", { method: "POST" });
    onLogout();
  };

  return (
    <>
      <div className="app-header">
        <h1 className="title">{title}</h1>
        <div className="menu-wrapper" ref={menuRef}>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)}>
            <span className="menu-icon" />
            <span className="menu-icon" />
            <span className="menu-icon" />
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              <button onClick={() => { navigate("/"); setMenuOpen(false); }}>Home</button>
              <button onClick={() => { navigate("/recipes"); setMenuOpen(false); }}>Recipes</button>
              <button onClick={() => { navigate("/history"); setMenuOpen(false); }}>Meal History</button>
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
    </>
  );
}
