import path from "path";
import express from "express";
import app from "./app";
import { startWeeklyMealCron } from "./cron/weeklyMeals";

const PORT = process.env.PORT || 3000;

// Serve React frontend in production
const clientDistPath = path.join(process.cwd(), "client/dist");
app.use(express.static(clientDistPath));
app.get("{*path}", (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startWeeklyMealCron();
});
