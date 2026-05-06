import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import pool from "../db";
import { setAuthCookie, clearAuthCookie, authenticate, AuthRequest } from "../middleware/auth";
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

export default router;
