# Onyx

Onyx is a self-hosted workout tracker: log lifts and cardio against routines, track body weight and measurements over time, and see trends — all in a single-page React app backed directly by Supabase (Postgres + Auth), no custom API server required.

## Features

- **Routines** — define per-day-of-week routines (exercises + cardio), with the option to override or mark any specific date as a rest day
- **Workout logging** — log sets/reps/weight against exercises (a merged list of global defaults and your own custom exercises), with a built-in plate calculator and rest timer
- **Cardio logging** — track type, duration, and distance
- **Body tracking** — body weight and circumference measurements (including navel) over time
- **History & trends** — browse past logs and visualize progress
- **Per-user settings** — weight/measurement/distance units, timer increments, and toggles for the rest timer, confetti celebration, and body-weight/measurement visibility, synced via Supabase and cached locally
- **Auth** — email-based sign-in via Supabase Auth; all data is scoped per-user via Row Level Security policies on the Supabase project
- **Installable** — Add to Home Screen (iOS/Android) or desktop install gives Onyx its own icon and a standalone window with no browser chrome; the app shell loads even with no connection, and writes made while offline (e.g. logging a set with no signal) are queued in IndexedDB and synced automatically once you're back online. The Today and Log screens also work offline off a local cache (exercises, routines, today's logs/PRs/last sets) — everywhere else still needs a live connection for reads

## Tech stack

- React 19 + Vite 7, written in TypeScript
- `react-router-dom` for client-side routing
- Tailwind CSS
- Supabase (`@supabase/supabase-js`) for auth, database, and realtime
- canvas-confetti for the completion celebration
- `vite-plugin-pwa` for the installable app shell (manifest + service worker)

## Getting started

### Prerequisites

- Node.js and npm
- A [Supabase](https://supabase.com) project (see "Supabase setup" below)
- Docker with Compose (only for the self-hosted deployment)

### Supabase setup

This repo does not ship SQL for the database; you create the schema in your own Supabase project. The app expects:

1. **Tables**: `global_exercises`, `custom_exercises`, `routines`, `workout_logs`, `cardio_logs`, `body_weights`, `circumferences`, `user_settings`, `daily_overrides`. Column names and types are defined by how `src/dataManager.ts` reads and writes them.
2. **Row Level Security** enabled on every user-owned table, with policies scoping rows to `auth.uid()` (each user may only select, insert, update and delete their own rows). `global_exercises` is shared, read-only reference data.
3. **Unique constraints** the upserts rely on: `user_settings` on `user_id`, and `daily_overrides` on `(user_id, date)`.
4. **RPC function** `get_exercise_stats(p_exercise_ids, p_before_date)`, called from `src/dataManager.ts`.
5. **Email auth** enabled (Authentication -> Providers -> Email).

Then copy the project URL and anon key from Project Settings -> API.

### Environment

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. `.env` is gitignored. The other variables in `.env.example` are optional and explained there.

### Local development

```bash
npm install
npm run dev        # start the dev server
npm run lint       # run ESLint
npm run typecheck  # run the TypeScript compiler (no emit)
npm run build      # typecheck, then production build to dist/
npm run preview    # serve the production build locally
npm run test       # run the test suite once
npm run test:watch # run the test suite in watch mode
```

Tests mock the Supabase client and do not need real credentials.

## Self-hosted deployment (Docker)

The included `Dockerfile` builds the app and serves it via nginx. Vite inlines environment variables at build time, so the Supabase credentials are passed as build args (not runtime env vars). `docker compose` reads them from your `.env` (or the shell):

```bash
docker compose up -d
```

The app is served on port `3010` by default; override with `PORT` (in `.env` or inline):

```bash
PORT=8080 docker compose up -d
```

After changing a `VITE_*` value, rebuild with `docker compose up -d --build`. `nginx.conf` handles SPA routing so client-side navigation works behind nginx.

## Claude Code / MCP tooling (optional)

You do not need this to run or develop the app. The repo includes a read-only Supabase MCP server config (`.mcp.json`) for use with Claude Code, so the assistant can inspect your project's schema and data. To use it:

1. Generate a personal access token in the Supabase dashboard (Account Settings -> Access Tokens).
2. Provide `SUPABASE_ACCESS_TOKEN` (the token, a secret) and `SUPABASE_PROJECT_REF` (your project's reference ID) to Claude Code through its environment: export them in your shell, or put them in an `env` block in the gitignored `.claude/settings.local.json`. Claude Code reads them from its own environment, not from `.env`.

If `SUPABASE_PROJECT_REF` is unset, only the Supabase MCP server fails to start; the app is unaffected. Never commit the token.
