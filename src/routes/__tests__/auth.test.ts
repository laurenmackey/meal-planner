import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { cleanDatabase, closeDatabase } from "../../test/setup";

describe("Auth routes", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("POST /api/v1/signup", () => {
    it("creates a new household and user", async () => {
      const res = await request(app)
        .post("/api/v1/signup")
        .send({ email: "new@test.com", password: "password123", householdName: "Test Family" });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe("new@test.com");
      expect(res.body.household.name).toBe("Test Family");
      expect(res.body.household.inviteCode).toBeTruthy();
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("joins an existing household with invite code", async () => {
      // First create a household
      const signup1 = await request(app)
        .post("/api/v1/signup")
        .send({ email: "user1@test.com", password: "password123", householdName: "Family" });
      const inviteCode = signup1.body.household.inviteCode;

      // Join with invite code
      const res = await request(app)
        .post("/api/v1/signup")
        .send({ email: "user2@test.com", password: "password123", inviteCode });

      expect(res.status).toBe(201);
      expect(res.body.household.id).toBe(signup1.body.household.id);
    });

    it("returns 400 for missing fields", async () => {
      const res = await request(app)
        .post("/api/v1/signup")
        .send({ email: "test@test.com" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for short password", async () => {
      const res = await request(app)
        .post("/api/v1/signup")
        .send({ email: "test@test.com", password: "short", householdName: "Family" });
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate email", async () => {
      await request(app)
        .post("/api/v1/signup")
        .send({ email: "dup@test.com", password: "password123", householdName: "Family" });

      const res = await request(app)
        .post("/api/v1/signup")
        .send({ email: "dup@test.com", password: "password123", householdName: "Family 2" });
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/v1/login", () => {
    it("logs in with correct credentials", async () => {
      await request(app)
        .post("/api/v1/signup")
        .send({ email: "login@test.com", password: "password123", householdName: "Family" });

      const res = await request(app)
        .post("/api/v1/login")
        .send({ email: "login@test.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("login@test.com");
    });

    it("returns 401 for wrong password", async () => {
      await request(app)
        .post("/api/v1/signup")
        .send({ email: "login@test.com", password: "password123", householdName: "Family" });

      const res = await request(app)
        .post("/api/v1/login")
        .send({ email: "login@test.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/me", () => {
    it("returns user info when authenticated", async () => {
      const signup = await request(app)
        .post("/api/v1/signup")
        .send({ email: "me@test.com", password: "password123", householdName: "Family" });

      const cookie = signup.headers["set-cookie"]![0];

      const res = await request(app)
        .get("/api/v1/me")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("me@test.com");
    });

    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/v1/me");
      expect(res.status).toBe(401);
    });
  });
});
