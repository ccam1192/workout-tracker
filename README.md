# Workout Tracker

A simple, mobile-first calisthenics and workout tracking web application. Create workout templates, complete your workouts as a checklist, and keep a history of your progress.

## Features

- **Workout Templates** — Create custom workout templates with exercises, sets, reps, duration, weight, notes, and YouTube form videos.
- **Circuit & Standard Workouts** — Supports both circuit-style workouts (multiple rounds) and standard workouts.
- **Workout Execution** — Start a workout, check off exercises as you go, and track your round time with a built-in timer.
- **Workout History** — View completed workouts in reverse chronological order with full detail.
- **Resume In-Progress** — Leave mid-workout and pick up exactly where you left off.
- **Starter Workout** — New users automatically get a seeded "Morning Calisthenics" circuit to get started immediately.
- **Authentication** — Email/password sign-up and login via Supabase Auth.
- **Row-Level Security** — All data is private to the authenticated user.
- **PWA-Ready** — Includes a web app manifest for add-to-home-screen support.

## Technology Stack

| Layer          | Technology                       |
| -------------- | -------------------------------- |
| Framework      | Next.js 16 (App Router)         |
| Language       | TypeScript                       |
| UI             | React 19, Tailwind CSS 4        |
| Icons          | Lucide React                     |
| Auth & DB      | Supabase (Auth + Postgres)      |
| Deployment     | Vercel (or any Node.js host)    |

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** (comes with Node.js)
- A **Supabase** project (free tier works)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New project** and give it a name (e.g. "Workout Tracker").
3. Choose a database password and region, then click **Create new project**.
4. Wait for the project to finish provisioning.

### 3. Find Your Supabase Credentials

1. In the Supabase dashboard, go to **Project Settings → API**.
2. Copy the **Project URL** — it looks like `https://abcdefghijkl.supabase.co`.
3. Copy the **anon / public** key (under "Project API keys").

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Then fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run the Database Schema

1. In the Supabase dashboard, go to the **SQL Editor**.
2. Click **New query**.
3. Open `supabase/schema.sql` from this project, copy its entire contents, and paste it into the SQL Editor.
4. Click **Run** (or press Cmd/Ctrl + Enter).

This creates all tables, indexes, Row-Level Security policies, triggers, and helper functions (starter workout seeding, workout session creation, workout completion).

### 6. Configure Authentication

Supabase email/password auth is enabled by default. If you want to skip email confirmation during development:

1. Go to **Authentication → Providers → Email** in the Supabase dashboard.
2. Toggle **Confirm email** off (optional, for faster local testing).
3. Save.

### 7. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app will show the landing page. Create an account to get started — a starter "Morning Calisthenics" workout will be automatically created for you.

## Build for Production

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push this project to a Git repository (GitHub, GitLab, or Bitbucket).
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Add the environment variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Vercel auto-detects Next.js and builds it correctly.

## Project Structure

```
src/
├── app/
│   ├── (app)/                  # Authenticated route group
│   │   ├── dashboard/          # Main dashboard
│   │   ├── workouts/           # Template list, create, detail, edit
│   │   ├── workout/            # Workout execution + completion
│   │   ├── history/            # History list + detail
│   │   └── settings/           # Account settings
│   ├── auth/callback/          # Supabase auth callback
│   ├── login/                  # Login page
│   ├── signup/                 # Signup page
│   ├── page.tsx                # Landing page
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Theme variables + base styles
├── components/
│   ├── ui/                     # Reusable primitives (Button, Alert, etc.)
│   ├── app-shell.tsx           # Layout shell with sidebar/bottom nav
│   ├── workout-player.tsx      # Workout execution engine
│   ├── workout-form.tsx        # Create/edit template form
│   └── ...                     # Other feature components
├── hooks/
│   └── use-start-workout.ts    # Hook for starting workout sessions
├── lib/
│   ├── supabase/               # Supabase client helpers
│   ├── types.ts                # TypeScript types
│   ├── dates.ts                # Date formatting utilities
│   ├── format.ts               # Exercise/status formatting
│   ├── exercises.ts            # Exercise draft helpers
│   ├── youtube.ts              # YouTube URL validation
│   └── utils.ts                # General utilities
└── proxy.ts                    # Auth proxy (Next.js request handling)

supabase/
└── schema.sql                  # Full database schema + RLS policies

public/
├── icon.svg                    # App icon
└── manifest.json               # PWA manifest
```

## Database Schema

The database has five main tables:

| Table                          | Purpose                                    |
| ------------------------------ | ------------------------------------------ |
| `profiles`                     | User profiles (linked to Supabase Auth)    |
| `workout_templates`            | Workout template definitions               |
| `workout_template_exercises`   | Exercises within a template                |
| `workout_sessions`             | Actual workout sessions performed          |
| `workout_session_exercises`    | Snapshot of exercises during a session     |
| `workout_session_rounds`       | Per-round timing data                      |

Historical workout records are preserved even when templates are edited — exercise data is copied into session exercises at the time the workout starts.

## Notes

- **No Supabase CLI required** — the schema is designed to be pasted directly into the Supabase SQL Editor.
- **No hard-coded credentials** — all configuration comes from environment variables.
- **Graceful degradation** — if Supabase is not configured, the app compiles and shows a clear configuration error instead of crashing.
