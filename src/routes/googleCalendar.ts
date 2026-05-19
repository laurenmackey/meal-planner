import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  getAuthUrl,
  handleCallback,
  disconnect,
  isConnected,
  createCalendarEvents,
} from "../services/googleCalendar";

const router = Router();

// GET /api/v1/google/status — check if Google Calendar is connected
router.get("/google/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const connected = await isConnected(req.user!.userId);
    res.json({ connected });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error checking Google status:", err);
    res.status(500).json({ error: "Failed to check Google status", details: message });
  }
});

// GET /api/v1/google/connect — redirect to Google OAuth consent
router.get("/google/connect", authenticate, (req: AuthRequest, res: Response) => {
  const url = getAuthUrl(req.user!.userId);
  res.json({ url });
});

// GET /api/v1/auth/google/callback — OAuth callback
router.get("/auth/google/callback", async (req: AuthRequest, res: Response) => {
  const { code, state } = req.query;

  if (!code || !state) {
    res.status(400).send("Missing code or state");
    return;
  }

  try {
    const userId = Number(state);
    await handleCallback(code as string, userId);
    // Redirect back to the app homepage
    const clientUrl = process.env.NODE_ENV === "production" ? "/" : "http://localhost:5173/";
    res.redirect(clientUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error during Google OAuth callback:", err);
    res.status(500).send("Failed to connect Google Calendar: " + message);
  }
});

// POST /api/v1/google/disconnect — remove Google Calendar connection
router.post("/google/disconnect", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await disconnect(req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error disconnecting Google:", err);
    res.status(500).json({ error: "Failed to disconnect Google Calendar", details: message });
  }
});

// POST /api/v1/google/addToCalendar
// Body: { events: Array<{ summary: string, date: string, startTime: string, durationMinutes: number }> }
router.post("/google/addToCalendar", authenticate, async (req: AuthRequest, res: Response) => {
  const { events } = req.body;

  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: "events must be a non-empty array" });
    return;
  }

  try {
    const result = await createCalendarEvents(req.user!.userId, req.user!.householdId, events);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error adding to calendar:", err);
    res.status(500).json({ error: "Failed to add to calendar", details: message });
  }
});

export default router;
