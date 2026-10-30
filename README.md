# Onyx

Onyx is a self-hosted workout tracker: log lifts and cardio against routines, track body weight and measurements over time, and see trends — all in a single-page React app backed directly by Supabase (Postgres + Auth), no custom API server required.

## Features

- **Routines** — define per-day-of-week routines (exercises + cardio), with the option to override or mark any specific date as a rest day (marking a rest day replaces a routine override on that date; un-resting returns to the scheduled routine, and the earlier override is not restored)
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

This repo does not ship the base schema; you create it in your own Supabase project. Schema changes made after that initial setup ship as timestamped SQL files in `supabase/migrations/`, and each one must be applied to your Supabase project (SQL editor or `supabase db push`) before you deploy the app version that needs it. The app expects:

1. **Tables**: `global_exercises`, `custom_exercises`, `routines`, `workout_logs`, `cardio_logs`, `body_weights`, `circumferences`, `user_settings`, `daily_overrides`. Column names and types are defined by how `src/dataManager.ts` reads and writes them. `daily_overrides` holds per-date overrides: either a routine override (`is_rest = false`, `routine_id` set) or a rest-day marker (`is_rest = true`, `routine_id` null), enforced by a check constraint. `is_rest` and the nullable `routine_id` come from `supabase/migrations/202610300000_daily_overrides_is_rest.sql`. It is a pre-deploy requirement: apply it before deploying this version of the app.
2. **Row Level Security (RLS)** enabled on all 9 tables. The anon key is shipped in the frontend bundle, so it is safe to expose only because RLS is enabled on every table.
   - User-owned tables use owner-scoped policies for the `authenticated` role: `auth.uid() = user_id`, set as both `USING` and `WITH CHECK`.
   - `global_exercises` is shared, read-only reference data: give it a `SELECT` policy only.
   - Grant each table only the privileges the app needs (to `authenticated`):

     | Table | Privileges |
     | --- | --- |
     | `body_weights`, `cardio_logs`, `routines`, `workout_logs` | SELECT, INSERT, UPDATE, DELETE |
     | `custom_exercises`, `circumferences` | SELECT, INSERT, DELETE |
     | `user_settings` | SELECT, INSERT, UPDATE (upsert) |
     | `daily_overrides` | SELECT, INSERT, UPDATE (upsert), DELETE |
     | `global_exercises` | SELECT (policy only, read-only) |

   - The `anon` role has no grants on user tables. Revoke the default anon grants, and set default privileges so tables created later do not grant `anon`.
3. **Unique constraints** the upserts rely on: `user_settings` on `user_id`, and `daily_overrides` on `(user_id, date)`.
4. **RPC function** `get_exercise_stats(p_exercise_ids text[], p_before_date date)`, called from `src/dataManager.ts`. It must be `SECURITY INVOKER` (so RLS applies to the caller), with a fixed `search_path`, and `EXECUTE` granted to `authenticated` only (revoked from `PUBLIC` and `anon`).
5. **Email auth** enabled (Authentication -> Providers -> Email), with sign-up disabled or invite-only (Authentication settings), so arbitrary users cannot create accounts.

Then copy the project URL and anon key from Project Settings -> API.

**Service-role key.** The service-role key bypasses RLS. It is server-side only: never put it in a `VITE_*` variable, the frontend bundle, or any committed file. Only the anon key goes in `VITE_SUPABASE_ANON_KEY`.

#### Example SQL

Generic, placeholder-only example for one table (`example_table`, with a `user_id uuid` column). Repeat the pattern for each user-owned table, adjusting the privileges per the table above.

```sql
-- Enable RLS and add owner-scoped policies
alter table public.example_table enable row level security;

create policy "example_table_select_own" on public.example_table
  for select to authenticated
  using (auth.uid() = user_id);

create policy "example_table_insert_own" on public.example_table
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "example_table_update_own" on public.example_table
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "example_table_delete_own" on public.example_table
  for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.example_table to authenticated;

-- Harden the RPC (keep your function body; add these attributes)
alter function public.get_exercise_stats(p_exercise_ids text[], p_before_date date)
  security invoker
  set search_path = public;

revoke execute on function public.get_exercise_stats(text[], date) from public, anon;
grant execute on function public.get_exercise_stats(text[], date) to authenticated;

-- Keep anon away from tables, now and in the future
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
```

#### How to verify

```sql
-- RLS is enabled on the 9 tables (expect relrowsecurity = true for each)
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('body_weights', 'cardio_logs', 'circumferences', 'custom_exercises',
                  'daily_overrides', 'global_exercises', 'routines', 'user_settings',
                  'workout_logs');

-- The function is SECURITY INVOKER (prosecdef = false) with the expected search_path
select proname, prosecdef, proconfig
from pg_proc
where proname = 'get_exercise_stats'
  and pronamespace = 'public'::regnamespace;

-- anon has no table privileges (expect zero rows)
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public';
```

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
