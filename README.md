# Meal Planner

A meal planning app that automates choosing weekly recipes and generating grocery lists.

## Tech Stack

- TypeScript (frontend and backend)
- React
- Node.js
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

Edit `.env` if you need to change the database URL (e.g., custom user/password/port).

3. **Create the database and run migrations:**

```bash
npm run db:setup
```

This creates the `meal_planner` database and runs all migrations (schema + seed data).

4. **Run the app (two terminals):**

```bash
# Terminal 1 - backend
npm run dev

# Terminal 2 - frontend
npm run dev:client
```

The backend runs at http://localhost:3000 and the frontend at http://localhost:5173.

## Database Scripts

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm run db:create`  | Create the `meal_planner` database               |
| `npm run db:drop`    | Drop the database                                |
| `npm run db:migrate` | Run all pending migrations                       |
| `npm run db:rollback`| Roll back the last migration                     |
| `npm run db:setup`   | Create database + run all migrations             |
| `npm run db:reset`   | Drop, recreate, and re-run all migrations        |

## Project Structure

```
meal-planner/
├── migrations/          # SQL migration files
│   ├── 001_create-tables.sql
│   └── 002_seed-data.sql
├── src/                 # Application source (coming soon)
├── .env.example
├── package.json
├── tsconfig.json
└── specs.md             # Full project spec and milestones
```
