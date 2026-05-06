import express from "express";
import mealsRouter from "./routes/meals";
import foodSelectionsRouter from "./routes/foodSelections";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api/v1", mealsRouter);
app.use("/api/v1", foodSelectionsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
