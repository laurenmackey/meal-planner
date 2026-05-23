import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const COOKIE_NAME = "meal_planner_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

export interface AuthPayload {
  userId: number;
  email: string;
  householdId: number;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function setAuthCookie(res: Response, payload: AuthPayload): void {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}

// Pending Google signup — stores Google profile until household is chosen
export const GOOGLE_PENDING_COOKIE = "google_pending";

export interface GooglePendingPayload {
  googleId: string;
  email: string;
  name: string;
}

export function setGooglePendingCookie(res: Response, payload: GooglePendingPayload): void {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
  res.cookie(GOOGLE_PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
  });
}

export function getGooglePendingPayload(req: Request): GooglePendingPayload | null {
  const token = req.cookies?.[GOOGLE_PENDING_COOKIE];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as GooglePendingPayload;
  } catch {
    return null;
  }
}

export function clearGooglePendingCookie(res: Response): void {
  res.clearCookie(GOOGLE_PENDING_COOKIE);
}
