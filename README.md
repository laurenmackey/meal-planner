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
| `EMAIL_FROM` | Sender email address for weekly emails | Yes (prod) |
| `APP_URL` | Public URL of the app (used in email links) | Yes (prod) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (Calendar integration) | Optional |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Optional |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Optional |
| `MCP_API_KEY` | API key for the MCP connector (Claude integration) | Optional |

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

You can share the `invite_code` with anyone you want to test with as part of your household. In production, you should share with other member(s) of your household so that all meal generation, settings, etc are shared. You can also see the invite code anytime in the app under Settings.

7. **Seed sample meals (optional):**

```bash
HOUSEHOLD_ID=<your_household_id> npm run db:seed
```

Replace `<your_household_id>` with the `id` from step 6. You can also manually add meals through the app.

## Features

### Meal Generation
Generate weekly meal suggestions based on a ranking algorithm that considers things like rating, easiness, health score, protein variety, and recency.

### Recipe Parsing
Add recipes by:
1. Pasting a URL — the app fetches the page and uses Claude to extract structured data (name, ingredients, protein, times, servings). If the URL is blocked (e.g. Cloudflare), a paste-text fallback lets you copy the recipe content manually. All parsed fields are editable before saving.
2. Uploading a photo - the app uses Claude to parse the photo and extract data like above.
3. Filling out a form manually.

### Weekly Email (Cron)
A cron job runs every Friday at 5pm PT, generates meal suggestions for each household, and emails the results via Resend. The email includes meal names, descriptions, recipe links, and a link to the app.

**Testing the email manually:**
```bash
curl -X POST http://localhost:3000/api/v1/testWeeklyEmail --cookie "meal_planner_session=SESSION_COOKIE"
```

### MCP Integration (Save Recipes from Claude)

The app includes a remote [MCP](https://modelcontextprotocol.io/) server that lets you save recipes directly from a Claude conversation. When chatting with Claude about a recipe, just say "save this to our meal planner" and Claude will extract the recipe details and save it to your database.

**Setup:**

1. Set the `MCP_API_KEY` env var on your deployment (any secure random string)
2. In [claude.ai](https://claude.ai), go to **Settings > Customize > Connectors > "+"**
3. Add a connector with:
   - **URL**: `https://<your-domain>/mcp/<MCP_API_KEY>/<household_id>`
4. Chat with Claude about recipes and ask it to save them to your meal planner

The connector works on claude.ai (web), Claude Desktop, and mobile.

## Testing

```bash
# One-time setup: create the test database and run migrations
npm run db:test:setup

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run unit tests only (no DB required)
npm run test:unit
```

## Deployment

The app is deployed on Railway. Any time code is merged to main, a new deploy is automatically triggered on Railway to get production up to date. Set all environment variables in the Railway service's Variables tab. Railway provides the `PORT` and `DATABASE_URL` automatically.
