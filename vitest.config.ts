import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "src",
    globals: true,
    testTimeout: 15000,
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://localhost/meal_planner_test",
    },
  },
});
