import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import app from "../../app";
import { cleanDatabase, closeDatabase, createTestUser } from "../../test/setup";

describe("Household settings routes", () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    await cleanDatabase();
    user = await createTestUser();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe("GET /api/v1/household/settings", () => {
    it("returns household settings with defaults", async () => {
      const res = await request(app)
        .get("/api/v1/household/settings")
        .set("Cookie", user.cookie);

      expect(res.status).toBe(200);
      expect(res.body.settings.lookbackWeeks).toBe(3);
      expect(res.body.settings.defaultMealCount).toBe(3);
      expect(res.body.settings.basicMealCount).toBe(2);
      expect(res.body.settings.preferredProteins).toEqual(["chicken", "turkey", "fish"]);
    });
  });

  describe("PUT /api/v1/household/settings", () => {
    it("updates settings and persists them", async () => {
      const update = await request(app)
        .put("/api/v1/household/settings")
        .set("Cookie", user.cookie)
        .send({
          lookbackWeeks: 5,
          ratingWeight: 0.5,
          easinessWeight: 0.3,
          healthWeight: 0.2,
          preferredProteins: ["beef", "pork"],
          defaultMealCount: 5,
          basicMealCount: 1,
        });

      expect(update.status).toBe(200);
      expect(update.body.settings.lookbackWeeks).toBe(5);
      expect(update.body.settings.defaultMealCount).toBe(5);
      expect(update.body.settings.basicMealCount).toBe(1);
      expect(update.body.settings.preferredProteins).toEqual(["beef", "pork"]);

      // Verify persistence
      const get = await request(app)
        .get("/api/v1/household/settings")
        .set("Cookie", user.cookie);
      expect(get.body.settings.lookbackWeeks).toBe(5);
    });
  });
});
