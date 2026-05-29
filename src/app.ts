import express from "express";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import mealsRouter from "./routes/meals";
import foodSelectionsRouter from "./routes/foodSelections";
import recipesRouter from "./routes/recipes";
import googleCalendarRouter from "./routes/googleCalendar";
import householdRouter from "./routes/household";
import { handleMcpPost, handleMcpGet, handleMcpDelete } from "./mcp";

const app = express();

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
app.use("/api/v1", authRouter);
app.use("/api/v1", mealsRouter);
app.use("/api/v1", foodSelectionsRouter);
app.use("/api/v1", recipesRouter);
app.use("/api/v1", googleCalendarRouter);
app.use("/api/v1", householdRouter);

// MCP endpoint for Claude integration
app.post("/mcp/:apiKey/:householdId", handleMcpPost);
app.get("/mcp/:apiKey/:householdId", handleMcpGet);
app.delete("/mcp/:apiKey/:householdId", handleMcpDelete);

export default app;
