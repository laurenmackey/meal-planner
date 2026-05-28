import React, { useEffect, useState } from "react";
import { MealSelection } from "../../../src/types";
import { apiFetch } from "../api";
import styles from "./GoogleCalendar.module.css";

// Smart default days for scheduling meals
function getDefaultDays(mealCount: number): number[] {
  switch (mealCount) {
    case 1: return [1];
    case 2: return [1, 3];
    case 3: return [1, 3, 5];
    case 4: return [1, 2, 3, 5];
    case 5: return [1, 2, 3, 4, 5];
    case 6: return [1, 2, 3, 4, 5, 6];
    case 7: return [0, 1, 2, 3, 4, 5, 6];
    default: {
      const days: number[] = [];
      for (let i = 0; i < mealCount; i++) {
        days.push(i % 7);
      }
      return days;
    }
  }
}

function getNextDateForDay(dayOfWeek: number, index: number): string {
  const today = new Date();
  const currentDay = today.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0) daysAhead += 7;
  const extraWeeks = Math.floor(index / 7);
  daysAhead += extraWeeks * 7;
  const date = new Date(today);
  date.setDate(today.getDate() + daysAhead);
  return date.toISOString().split("T")[0];
}

interface GoogleCalendarProps {
  meals: MealSelection[];
}

export default function GoogleCalendar({ meals }: GoogleCalendarProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [schedule, setSchedule] = useState<Array<{ mealName: string; date: string; startTime: string }>>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiFetch("/api/v1/google/status");
        const data = await res.json();
        setConnected(data.connected);
      } catch {
        setConnected(false);
      }
    };
    check();
  }, []);

  const connect = async () => {
    try {
      const res = await apiFetch("/api/v1/google/connect");
      const data = await res.json();
      window.location.href = data.url;
    } catch {
      setLocalError("Failed to connect to Google Calendar");
    }
  };

  const disconnect = async () => {
    try {
      await apiFetch("/api/v1/google/disconnect", { method: "POST" });
      setConnected(false);
    } catch {
      setLocalError("Failed to disconnect Google Calendar");
    }
  };

  const openSchedule = () => {
    if (schedule.length === 0) {
      const days = getDefaultDays(meals.length);
      const dates = days.map((d, i) => getNextDateForDay(d, i)).sort();
      setSchedule(meals.map((meal, i) => ({
        mealName: meal.name,
        date: dates[i],
        startTime: "17:00",
      })));
    }
    setShowSchedule(true);
    setSuccess(false);
    setDirty(false);
  };

  const addToCalendar = async () => {
    setAdding(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const events = schedule.map((s, i) => ({
        summary: s.mealName,
        date: s.date,
        startTime: s.startTime,
        durationMinutes: 60,
        eventId: eventIds[i] || undefined,
        timeZone,
      }));
      const res = await apiFetch("/api/v1/google/addToCalendar", {
        method: "POST",
        body: JSON.stringify({ events }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocalError(data.error || "Failed to add to calendar");
        if (res.status === 401) setConnected(false);
        return;
      }
      setEventIds(data.eventIds);
      setSuccess(true);
      setDirty(false);
    } catch {
      setLocalError("Failed to connect to server");
    } finally {
      setAdding(false);
    }
  };

  const updateScheduleEntry = (index: number, field: "date" | "startTime", value: string) => {
    setSchedule((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    setDirty(true);
  };

  if (connected === null) return null;

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Google Calendar</h2>
      {localError && (
        <div className="error-toast" style={{ marginBottom: 12 }}>
          <span>{localError}</span>
          <button className="error-close" onClick={() => setLocalError(null)}>x</button>
        </div>
      )}
      {!connected ? (
        <button className="generate-button" onClick={connect}>
          Connect Google Calendar
        </button>
      ) : (
        <div>
          {!showSchedule ? (
            <div className={styles.actions}>
              {eventIds.length > 0 ? (
                <>
                  <span className={styles.added}>Added to Calendar</span>
                  <a href="#" className={styles.editLink} onClick={(e) => { e.preventDefault(); openSchedule(); }}>
                    Edit Schedule
                  </a>
                </>
              ) : (
                <button className="generate-button" onClick={openSchedule}>
                  Add Meals to Calendar
                </button>
              )}
              <button className={styles.disconnect} onClick={disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className={styles.schedule}>
              {schedule.map((s, i) => (
                <div key={i} className={styles.row}>
                  <span className={styles.mealName}>{s.mealName}</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={s.date}
                    onChange={(e) => updateScheduleEntry(i, "date", e.target.value)}
                  />
                  <input
                    type="time"
                    className={styles.timeInput}
                    value={s.startTime}
                    onChange={(e) => updateScheduleEntry(i, "startTime", e.target.value)}
                  />
                </div>
              ))}
              <div className={styles.actions}>
                {(!success || dirty) && (
                  <button
                    className="generate-button"
                    onClick={addToCalendar}
                    disabled={adding}
                  >
                    {adding ? "Adding..." : eventIds.length > 0 ? "Update Calendar" : "Confirm & Add"}
                  </button>
                )}
                <button className="back-button" onClick={() => setShowSchedule(false)}>
                  {success && !dirty ? "Done" : "Cancel"}
                </button>
              </div>
              {success && !dirty && (
                <p className="save-success">Meals added to your Google Calendar!</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
