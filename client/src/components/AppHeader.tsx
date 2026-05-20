import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  title: string;
  onLogout: () => void;
}

export default function AppHeader({ title, onLogout }: AppHeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
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

  const handleLogout = async () => {
    await apiFetch("/api/v1/logout", { method: "POST" });
    onLogout();
  };

  return (
    <div className={styles.header}>
      <h1 className="title">{title}</h1>
      <div className={styles.menuWrapper} ref={menuRef}>
        <button className={styles.menuButton} onClick={() => setMenuOpen(!menuOpen)}>
          <span className={styles.menuIcon} />
          <span className={styles.menuIcon} />
          <span className={styles.menuIcon} />
        </button>
        {menuOpen && (
          <div className={styles.dropdown}>
            <button onClick={() => { navigate("/"); setMenuOpen(false); }}>Home</button>
            <button onClick={() => { navigate("/recipes"); setMenuOpen(false); }}>Recipes</button>
            <button onClick={() => { navigate("/history"); setMenuOpen(false); }}>Meal History</button>
            <button onClick={() => { navigate("/settings"); setMenuOpen(false); }}>Settings</button>
            <button onClick={handleLogout}>Log Out</button>
          </div>
        )}
      </div>
    </div>
  );
}
