import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import authRouter from "./routes/auth";
import mealsRouter from "./routes/meals";
import foodSelectionsRouter from "./routes/foodSelections";
import recipesRouter from "./routes/recipes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use("/api/v1", authRouter);
app.use("/api/v1", mealsRouter);
app.use("/api/v1", foodSelectionsRouter);
app.use("/api/v1", recipesRouter);

// Serve React frontend in production
const clientDistPath = path.join(process.cwd(), "client/dist");
app.use(express.static(clientDistPath));
app.get("{*path}", (_req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
