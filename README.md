# Meal Planner

A family meal planning app that automates choosing weekly recipes and generating grocery lists.

## Tech Stack

- TypeScript (frontend and backend)
- React + Vite + React Router
- Express
- PostgreSQL
- Resend (email)
- Claude API (recipe parsing)

## Prerequisites

- Node.js (v20+)
- PostgreSQL (v14+)

### Installing PostgreSQL on macOS

```bash
brew install postgresql@16
brew services start postgresql@16
```

After installing, make sure `psql` is on your PATH. Homebrew will print instructions, but typically:

```bash
# For bash:
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile

# For zsh:
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Getting Started

1. **Install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description | Required |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for signing auth tokens | Yes (prod) |
| `ANTHROPIC_API_KEY` | Claude API key for recipe parsing | Yes |
| `NYT_COOKING_COOKIE` | Cookie for fetching NYT Cooking recipes | Optional |
| `RESEND_API_KEY` | Resend API key for weekly emails | Yes |
| `RESEND_ALLOWED_EMAILS` | Comma-separated list of allowed recipients (for Resend free tier without custom domain) | Optional |
| `APP_URL` | Public URL of the app (used in email links) | Yes (prod) |

3. **Create the database and run migrations:**

```bash
npm run db:setup
```

4. **Run the app (two terminals):**

```bash
# Terminal 1 - backend
npm run dev

# Terminal 2 - frontend
npm run dev:client
```

The backend runs at http://localhost:3000 and the frontend at http://localhost:5173.

5. **Sign up and create your household:**

Open http://localhost:5173, click "Sign up", enter your email and password, and create a household name (e.g. "Apple Mackey Family").

6. **Find your household ID:**

```bash
psql -d meal_planner -c "SELECT id, name, invite_code FROM households;"
```

Share the `invite_code` with your partner so they can sign up and join the same household. You can also see the invite code in the app via the hamburger menu.

7. **Seed sample meals (optional):**

```bash
HOUSEHOLD_ID=<your_household_id> npm run db:seed
```

Replace `<your_household_id>` with the `id` from step 6.

## Features

### Meal Generation
Generate weekly meal suggestions based on a ranking algorithm that considers rating, easiness, health score, protein variety, and recency.

### Recipe Parsing
Add recipes by pasting a URL — the app fetches the page and uses Claude to extract structured data (name, ingredients, protein, times, servings). If the URL is blocked (e.g. Cloudflare), a paste-text fallback lets you copy the recipe content manually. All parsed fields are editable before saving.

### Weekly Email (Cron)
A cron job runs every Friday at 5pm PT, generates meal suggestions for each household, and emails the results via Resend. The email includes meal names, descriptions, recipe links, and a link to the app.

**Resend free tier note:** Without a custom domain, Resend only allows sending to the email you signed up with. Set `RESEND_ALLOWED_EMAILS` to filter recipients. Once you add a custom domain in Resend, remove this variable to send to all household members.

**Testing the email manually:**
```bash
curl -X POST http://localhost:3000/api/v1/testWeeklyEmail --cookie "meal_planner_session=SESSION_COOKIE"
```

## Database Scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run db:create`  | Create the `meal_planner` database               |
| `npm run db:drop`    | Drop the database                                |
| `npm run db:migrate` | Run all pending migrations                       |
| `npm run db:rollback`| Roll back the last migration                     |
| `npm run db:setup`   | Create database + run all migrations             |
| `npm run db:reset`   | Drop, recreate, and re-run all migrations        |
| `npm run db:seed`    | Seed sample meals/staples (requires HOUSEHOLD_ID)|

## Project Structure

```
meal-planner/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components (AuthPage, MealCard, AddRecipePage)
│   │   ├── api.ts       # API fetch helper
│   │   ├── App.tsx      # Main app with routing
│   │   └── App.css      # Styles
│   └── index.html
├── migrations/          # SQL migration files
├── scripts/             # Manual scripts (seed data)
├── src/                 # Express backend
│   ├── cron/            # Scheduled jobs (weekly meal email)
│   ├── middleware/       # Auth middleware
│   ├── routes/          # API routes
│   ├── services/        # Shared business logic (meal selection)
│   ├── db.ts            # Database connection
│   ├── mappers.ts       # DB row to TS type mappers
│   ├── types.ts         # Shared TypeScript types
│   └── server.ts        # Express server
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Deployment

The app is deployed on Railway. Set all environment variables in the Railway service's Variables tab. Railway provides the `PORT` and `DATABASE_URL` automatically.
