# Workout Tracker

A personal, mobile-first workout tracker built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

### Core
- **Authentication** — Email/password sign-up and login via Supabase Auth
- **Workout Templates** — Create, edit, and delete reusable workout templates
- **Standard & Circuit Workouts** — Track standard sets-based workouts or timed circuit rounds
- **Workout Execution** — Optimistic-UI exercise completion, round timers, pause/resume
- **Workout History** — Browse completed workouts with exercise-level detail
- **YouTube Form Links** — Attach form videos to exercises, opened during workouts
- **Starter Workout** — Auto-created "Morning Calisthenics" circuit for new users
- **Mobile-first Responsive UI** — Optimized for phones (375–430px) with desktop support

### V2 — Exercise Library
- **50 Built-in Exercises** — 25 calisthenics + 25 weight-training exercises with form instructions
- **Exercise Picker** — Search and filter exercises by category when creating/editing workouts
- **Custom Exercises** — Create personal exercises that auto-save to your library for reuse
- **Exercise Library Page** — Browse, search, edit, and delete your exercises at `/exercises`
- **Library ↔ Workout Independence** — Workout exercises reference the library but store their own settings; changing a workout does not change the library or other workouts

### V2 — Run Tracker
- **GPS Run Tracking** — Start a run from the dashboard, track distance via the browser Geolocation API
- **Haversine Distance Calculation** — Accurate GPS-based distance with invalid-point filtering
- **Pause/Resume** — Pause your run without counting paused time or distance
- **Run History** — Runs appear alongside workouts in History with distance, time, and pace
- **GPS Error Handling** — Clear messages for denied permissions, unavailable GPS, or signal loss

### V2 — History & Performance
- **Delete Workout History** — Remove any completed session from history with confirmation
- **Paginated History** — Loads 20 sessions at a time with "Load More"
- **Performance Indexes** — Optimized database indexes for common queries
- **Optimistic UI** — Exercise completion updates instantly before database confirmation

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS 4
- **Backend**: Supabase (Auth + PostgreSQL + RLS)
- **Icons**: Lucide React
- **Deployment**: Vercel

## Getting Started

### Prerequisites
- Node.js 20+
- A Supabase project

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Run the database schema:
   - **Fresh install**: Run `supabase/schema.sql` in the Supabase SQL Editor
   - **Existing database**: Run `supabase/migrations/002_v2_features.sql` to add V2 features
5. Start the dev server:
   ```bash
   npm run dev
   ```

### V2 Migration (Existing Databases)

If you already have the V1 schema, run the migration file to add V2 features:

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/002_v2_features.sql
```

This migration:
- Creates the `exercise_library` table with RLS policies
- Adds `exercise_library_id` to `workout_template_exercises`
- Extends `workout_sessions` with run fields (distance, GPS data)
- Adds `start_run_session` and `complete_run_session` RPC functions
- Seeds 50 built-in exercises (only if none exist)
- Adds performance indexes

**No existing data is modified or deleted.**

## GPS / Run Tracking Notes

- GPS requires **HTTPS** — Vercel deployment provides this automatically
- `localhost` works for development (browsers allow geolocation on localhost)
- Location permission is requested only when starting a run, not on app load
- GPS accuracy filtering: points with accuracy > 50m are ignored
- Speed filtering: movements > 30 mph are filtered as GPS errors
- GPS data is stored as JSONB in the session record, not on every update
- GPS data is protected by Supabase Row Level Security

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Authenticated routes
│   │   ├── dashboard/      # Main dashboard
│   │   ├── exercises/      # Exercise library (V2)
│   │   ├── history/        # Workout history
│   │   ├── settings/       # User settings
│   │   ├── workout/        # Active workout/run player
│   │   └── workouts/       # Workout template CRUD
│   ├── auth/               # OAuth callback
│   ├── login/              # Login page
│   └── signup/             # Signup page
├── components/
│   ├── ui/                 # Reusable UI primitives
│   ├── exercise-picker.tsx # Library exercise search (V2)
│   ├── run-tracker.tsx     # GPS run tracking UI (V2)
│   └── ...
├── hooks/
│   └── use-start-workout.ts
└── lib/
    ├── supabase/           # Supabase client/server helpers
    ├── gps.ts              # Haversine, GPS validation (V2)
    ├── types.ts            # TypeScript types
    └── ...

supabase/
├── schema.sql              # Full database schema (V2)
└── migrations/
    └── 002_v2_features.sql # Additive V2 migration
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous/public key |

No service-role keys are exposed to the browser. All data access is governed by RLS policies.
