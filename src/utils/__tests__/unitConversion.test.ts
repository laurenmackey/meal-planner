import { describe, it, expect } from "vitest";
import { bestDisplayUnit, UNIT_TO_GROUP, UNIT_GROUPS } from "../unitConversion";

describe("UNIT_TO_GROUP", () => {
  it("maps all volume units correctly", () => {
    expect(UNIT_TO_GROUP["tsp"]).toEqual({ group: "volume", factor: 1 });
    expect(UNIT_TO_GROUP["tbsp"]).toEqual({ group: "volume", factor: 3 });
    expect(UNIT_TO_GROUP["cups"]).toEqual({ group: "volume", factor: 48 });
  });

  it("maps all weight units correctly", () => {
    expect(UNIT_TO_GROUP["oz"]).toEqual({ group: "weight", factor: 1 });
    expect(UNIT_TO_GROUP["lb"]).toEqual({ group: "weight", factor: 16 });
  });

  it("maps metric units correctly", () => {
    expect(UNIT_TO_GROUP["g"]).toEqual({ group: "metric_weight", factor: 1 });
    expect(UNIT_TO_GROUP["ml"]).toEqual({ group: "metric_volume", factor: 1 });
    expect(UNIT_TO_GROUP["l"]).toEqual({ group: "metric_volume", factor: 1000 });
  });

  it("does not include non-convertible units", () => {
    expect(UNIT_TO_GROUP["whole"]).toBeUndefined();
    expect(UNIT_TO_GROUP["cloves"]).toBeUndefined();
    expect(UNIT_TO_GROUP["pinch"]).toBeUndefined();
  });
});

describe("bestDisplayUnit", () => {
  it("picks cups when quantity is large enough", () => {
    // 96 tsp = 2 cups
    const result = bestDisplayUnit(96, "volume");
    expect(result).toEqual({ quantity: 2, unit: "cups" });
  });

  it("picks tbsp for medium quantities", () => {
    // 6 tsp = 2 tbsp
    const result = bestDisplayUnit(6, "volume");
    expect(result).toEqual({ quantity: 2, unit: "tbsp" });
  });

  it("stays in tsp for small quantities", () => {
    const result = bestDisplayUnit(2, "volume");
    expect(result).toEqual({ quantity: 2, unit: "tsp" });
  });

  it("picks lb for large weight quantities", () => {
    // 32 oz = 2 lb
    const result = bestDisplayUnit(32, "weight");
    expect(result).toEqual({ quantity: 2, unit: "lb" });
  });

  it("stays in oz for small weight quantities", () => {
    const result = bestDisplayUnit(8, "weight");
    expect(result).toEqual({ quantity: 8, unit: "oz" });
  });

  it("picks liters for large metric volume", () => {
    // 2000 ml = 2 l
    const result = bestDisplayUnit(2000, "metric_volume");
    expect(result).toEqual({ quantity: 2, unit: "l" });
  });

  it("stays in ml for small metric volume", () => {
    const result = bestDisplayUnit(250, "metric_volume");
    expect(result).toEqual({ quantity: 250, unit: "ml" });
  });

  it("rounds to 2 decimal places", () => {
    // 7 tsp in tbsp = 2.333...
    const result = bestDisplayUnit(7, "volume");
    expect(result).toEqual({ quantity: 2.33, unit: "tbsp" });
  });

  it("falls back to base unit when quantity < 1 in all units", () => {
    const result = bestDisplayUnit(0.5, "volume");
    expect(result).toEqual({ quantity: 0.5, unit: "tsp" });
  });
});
