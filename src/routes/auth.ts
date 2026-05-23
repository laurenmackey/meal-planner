import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { google } from "googleapis";
import pool from "../db";
import {
  setAuthCookie, clearAuthCookie, authenticate, AuthRequest,
  setGooglePendingCookie, getGooglePendingPayload, clearGooglePendingCookie,
} from "../middleware/auth";
import { AuthResponse, MeResponse } from "../types";

const router = Router();
const SALT_ROUNDS = 10;

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex");
}

// POST /api/v1/signup
// Body: { email, password, householdName } — creates a new household
// Body: { email, password, inviteCode } — joins an existing household
router.post("/signup", async (req: Request, res: Response) => {
  const { email, password, householdName, inviteCode } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  if (!householdName && !inviteCode) {
    res.status(400).json({ error: "Either householdName or inviteCode is required" });
    return;
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    let householdId: number;

    if (inviteCode) {
      // Join existing household
      const householdResult = await pool.query(
        "SELECT id FROM households WHERE invite_code = $1",
        [inviteCode]
      );
      if (householdResult.rows.length === 0) {
        res.status(404).json({ error: "Invalid invite code" });
        return;
      }
      householdId = householdResult.rows[0].id;
    } else {
      // Create new household, retry if invite code collides
      let householdResult;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateInviteCode();
        try {
          householdResult = await pool.query(
            "INSERT INTO households (name, invite_code) VALUES ($1, $2) RETURNING id",
            [householdName, code]
          );
          break;
        } catch (err: any) {
          if (err.code !== "23505" || attempt === 4) throw err;
        }
      }
      householdId = householdResult!.rows[0].id;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, household_id) VALUES ($1, $2, $3) RETURNING id, email",
      [email, passwordHash, householdId]
    );

    const user = result.rows[0];
    setAuthCookie(res, { userId: user.id, email: user.email, householdId });

    // Fetch household info to return invite code
    const household = await pool.query("SELECT name, invite_code FROM households WHERE id = $1", [householdId]);

    const response: AuthResponse = {
      user: { id: user.id, email: user.email },
      household: {
        id: householdId,
        name: household.rows[0].name,
        inviteCode: household.rows[0].invite_code,
      },
    };
    res.status(201).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error during signup:", err);
    res.status(500).json({ error: "Signup failed", details: message });
  }
});

// POST /api/v1/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT u.*, h.name AS household_name, h.invite_code
       FROM users u
       JOIN households h ON h.id = u.household_id
       WHERE u.email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      res.status(401).json({ error: "This account uses Google sign-in" });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    setAuthCookie(res, {
      userId: user.id,
      email: user.email,
      householdId: user.household_id,
    });

    const response: AuthResponse = {
      user: { id: user.id, email: user.email },
      household: {
        id: user.household_id,
        name: user.household_name,
        inviteCode: user.invite_code,
      },
    };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error during login:", err);
    res.status(500).json({ error: "Login failed", details: message });
  }
});

// POST /api/v1/logout
router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/v1/me — check if currently authenticated
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  const household = await pool.query(
    "SELECT id, name, invite_code FROM households WHERE id = $1",
    [req.user!.householdId]
  );
  const response: MeResponse = {
    user: { userId: req.user!.userId, email: req.user!.email },
    household: {
      id: household.rows[0].id,
      name: household.rows[0].name,
      inviteCode: household.rows[0].invite_code,
    },
  };
  res.json(response);
});

// Google OAuth login flow

function getGoogleLoginClient() {
  const redirectUri = process.env.GOOGLE_LOGIN_REDIRECT_URI
    || (process.env.GOOGLE_REDIRECT_URI || "").replace("/auth/google/callback", "/auth/google/login/callback");
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// GET /api/v1/auth/google/login — get Google OAuth URL for login
router.get("/auth/google/login", (_req: Request, res: Response) => {
  const client = getGoogleLoginClient();
  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
  res.json({ url });
});

// GET /api/v1/auth/google/login/callback — Google OAuth login callback
router.get("/auth/google/login/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).send("Missing code");
    return;
  }

  try {
    const client = getGoogleLoginClient();
    const { tokens } = await client.getToken(code as string);
    client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email || !profile.id) {
      res.status(400).send("Could not retrieve email from Google");
      return;
    }

    // Check if user exists by google_id or email
    let userResult = await pool.query(
      `SELECT u.*, h.name AS household_name, h.invite_code
       FROM users u
       JOIN households h ON h.id = u.household_id
       WHERE u.google_id = $1 OR u.email = $2
       LIMIT 1`,
      [profile.id, profile.email]
    );

    const clientUrl = process.env.NODE_ENV === "production" ? "/" : "http://localhost:5173/";

    if (userResult.rows.length > 0) {
      // Existing user — link google_id if not already set, then log in
      const user = userResult.rows[0];
      if (!user.google_id) {
        await pool.query("UPDATE users SET google_id = $1 WHERE id = $2", [profile.id, user.id]);
      }

      setAuthCookie(res, {
        userId: user.id,
        email: user.email,
        householdId: user.household_id,
      });
      res.redirect(clientUrl);
    } else {
      // New user — store profile in pending cookie, redirect to household setup
      setGooglePendingCookie(res, {
        googleId: profile.id,
        email: profile.email,
        name: profile.name || "",
      });
      res.redirect(`${clientUrl}?google_setup=true`);
    }
  } catch (err) {
    console.error("Google login error:", err);
    const clientUrl = process.env.NODE_ENV === "production" ? "/" : "http://localhost:5173/";
    res.redirect(`${clientUrl}?error=google_login_failed`);
  }
});

// POST /api/v1/auth/google/complete — finish Google signup with household choice
router.post("/auth/google/complete", async (req: Request, res: Response) => {
  const pending = getGooglePendingPayload(req);
  if (!pending) {
    res.status(400).json({ error: "Google sign-in session expired. Please try again." });
    return;
  }

  const { householdName, inviteCode } = req.body;
  if (!householdName && !inviteCode) {
    res.status(400).json({ error: "Either householdName or inviteCode is required" });
    return;
  }

  try {
    // Double-check user wasn't created in the meantime
    const existing = await pool.query("SELECT id FROM users WHERE email = $1 OR google_id = $2", [pending.email, pending.googleId]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Account already exists. Please sign in." });
      clearGooglePendingCookie(res);
      return;
    }

    let householdId: number;

    if (inviteCode) {
      const householdResult = await pool.query(
        "SELECT id FROM households WHERE invite_code = $1",
        [inviteCode]
      );
      if (householdResult.rows.length === 0) {
        res.status(404).json({ error: "Invalid invite code" });
        return;
      }
      householdId = householdResult.rows[0].id;
    } else {
      let householdResult;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateInviteCode();
        try {
          householdResult = await pool.query(
            "INSERT INTO households (name, invite_code) VALUES ($1, $2) RETURNING id",
            [householdName, code]
          );
          break;
        } catch (err: any) {
          if (err.code !== "23505" || attempt === 4) throw err;
        }
      }
      householdId = householdResult!.rows[0].id;
    }

    const result = await pool.query(
      "INSERT INTO users (email, google_id, household_id) VALUES ($1, $2, $3) RETURNING id, email",
      [pending.email, pending.googleId, householdId]
    );

    const user = result.rows[0];
    clearGooglePendingCookie(res);
    setAuthCookie(res, { userId: user.id, email: user.email, householdId });

    const household = await pool.query("SELECT name, invite_code FROM households WHERE id = $1", [householdId]);

    const response: AuthResponse = {
      user: { id: user.id, email: user.email },
      household: {
        id: householdId,
        name: household.rows[0].name,
        inviteCode: household.rows[0].invite_code,
      },
    };
    res.status(201).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error completing Google signup:", err);
    res.status(500).json({ error: "Signup failed", details: message });
  }
});

export default router;
