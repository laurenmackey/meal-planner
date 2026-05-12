import cron from "node-cron";
import { Resend } from "resend";
import pool from "../db";
import { chooseWeeklyMeals, DEFAULT_MEAL_COUNT } from "../services/mealSelection";
import { MealSelection } from "../types";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const EMAIL_FROM = process.env.EMAIL_FROM || "Meal Planner <onboarding@resend.dev>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function buildEmailHtml(meals: MealSelection[]): string {
  if (meals.length === 0) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Weekly Meal Suggestions</h2>
        <p>No eligible meals were found this week. Try adding more recipes!</p>
        <p><a href="${APP_URL}">Open Meal Planner</a></p>
      </div>
    `;
  }

  const mealRows = meals
    .map(
      (meal) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <strong>${meal.name}</strong>
          ${meal.description ? `<br><span style="color: #666; font-size: 14px;">${meal.description}</span>` : ""}
          <br>
          <span style="color: #888; font-size: 13px;">
            ${meal.mainProtein && meal.mainProtein !== "none" ? meal.mainProtein + " · " : ""}
            ${meal.prepTimeMinutes ? meal.prepTimeMinutes + " min prep · " : ""}
            ${meal.cookTimeMinutes ? meal.cookTimeMinutes + " min cook · " : ""}
            Serves ${meal.servingSize}
          </span>
          ${meal.url ? `<br><a href="${meal.url}" style="color: #2d6a4f; font-size: 13px;">View recipe</a>` : ""}
        </td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2d6a4f;">This Week's Meal Suggestions</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${mealRows}
      </table>
      <p style="margin-top: 20px;">
        <a href="${APP_URL}" style="display: inline-block; padding: 10px 20px; background-color: #2d6a4f; color: #fff; text-decoration: none; border-radius: 6px;">
          View in Meal Planner
        </a>
      </p>
      <p style="color: #888; font-size: 13px;">You can reject meals and generate new ones from the app.</p>
    </div>
  `;
}

async function getHouseholdEmails(householdId: number): Promise<string[]> {
  const result = await pool.query(
    "SELECT email FROM users WHERE household_id = $1",
    [householdId]
  );
  return result.rows.map((r) => r.email);
}

async function runWeeklyMealJob() {
  console.log("Running weekly meal cron job...");
  try {
    // Get all households
    const households = await pool.query("SELECT id FROM households");

    for (const household of households.rows) {
      const householdId = household.id;
      const meals = await chooseWeeklyMeals(householdId, DEFAULT_MEAL_COUNT);
      const emails = await getHouseholdEmails(householdId);

      if (emails.length === 0) continue;

      const html = buildEmailHtml(meals);

      // Without a custom domain, Resend only allows sending to the account owner's email.
      // Filter to allowed recipients until a domain is configured.
      const allowedEmails = process.env.RESEND_ALLOWED_EMAILS
        ? process.env.RESEND_ALLOWED_EMAILS.split(",").map((e) => e.trim())
        : emails;
      const recipients = emails.filter((e) => allowedEmails.includes(e));
      if (recipients.length === 0) continue;

      const result = await getResend().emails.send({
        from: EMAIL_FROM,
        to: recipients,
        subject: `🍽️ Your Weekly Meal Suggestions (${meals.length} meals)`,
        html,
      });

      console.log("Resend response:", JSON.stringify(result));
      console.log(`Sent weekly meals email to ${emails.join(", ")} for household ${householdId}`);
    }
  } catch (err) {
    console.error("Weekly meal cron job failed:", err);
  }
}

// Every Friday at 5pm PT (which is midnight Saturday UTC during PDT, or 1am during PST)
// Using America/Los_Angeles timezone
export function startWeeklyMealCron() {
  cron.schedule("0 17 * * 5", runWeeklyMealJob, {
    timezone: "America/Los_Angeles",
  });
  console.log("Weekly meal cron job scheduled for Fridays at 5:00 PM PT");
}

// Export for manual testing
export { runWeeklyMealJob };
