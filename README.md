# Meal Planner

A family meal planning app that automates choosing weekly recipes and generating grocery lists.

## Tech Stack

- TypeScript (frontend and backend)
- React + Vite
- Express
- PostgreSQL

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

Edit `.env` if you need to change the database URL.

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

Share the `invite_code` with your partner so they can sign up and join the same household. You can also see the invite code in the UI once logged in.

7. **Seed sample meals (optional):**

```bash
HOUSEHOLD_ID=<your_household_id> npm run db:seed
```

Replace `<your_household_id>` with the `id` from step 6.

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
│   │   ├── components/  # React components
│   │   ├── api.ts       # API fetch helper
│   │   ├── App.tsx      # Main app component
│   │   └── App.css      # Styles
│   └── index.html
├── migrations/          # SQL migration files
├── scripts/             # Manual scripts (seed data)
├── src/                 # Express backend
│   ├── middleware/       # Auth middleware
│   ├── routes/          # API routes
│   ├── db.ts            # Database connection
│   ├── mappers.ts       # DB row to TS type mappers
│   ├── types.ts         # Shared TypeScript types
│   └── server.ts        # Express server
├── package.json
├── tsconfig.json
└── vite.config.ts
```
