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
- **50 Built-in Global Exercises** — 25 calisthenics + 25 weight-training exercises with form instructions
- **Exercise Picker** — Search and filter exercises by category when creating/editing workouts
- **Custom Exercises** — Create personal exercises that auto-save to your library for reuse
- **Exercise Library Page** — Browse, search, edit, and delete your exercises at `/exercises`
- **Library ↔ Workout Independence** — Workout exercises reference the library but store their own settings; changing a workout does not change the library or other workouts

### V2 — Admin & Roles
- **Role System** — `user` and `admin` roles enforced in the database via RLS
- **Admin Exercise Management** — Admin-only page at `/admin/exercises` for managing global exercises
- **Server-side Authorization** — Admin RLS policies prevent normal users from modifying global exercises

### V2 — AI Workout Builder
- **AI-Powered Workout Creation** — Describe what you want ("30 min dumbbell full body") and get a workout
- **Conversational Iteration** — Refine workouts: "make it shorter", "add more legs", "remove barbell exercises"
- **Exercise Library Integration** — AI uses your exercise library; proposes new exercises only when needed
- **Structured Output** — AI returns validated JSON, not freeform text
- **Create & Start** — Save and immediately start AI-generated workouts
- **Per-User OpenAI Keys** — Each user provides their own OpenAI API key; the app does not pay for AI usage
- **Disabled State** — Clear messaging when AI is not configured, with link to Settings

### V2 — API Key Security
- **AES-256-GCM Encryption** — API keys are encrypted server-side before storage
- **Server-Only Decryption** — Keys are decrypted only on the server during AI requests
- **Never Exposed to Browser** — Encrypted keys, decrypted values, and the encryption key never reach client code
- **Masked Display** — Only a hint like `sk-••••••7K9` is shown in Settings

### V2 — Run Tracker
- **GPS Run Tracking** — Start a run from the dashboard, track distance via the browser Geolocation API
- **Haversine Distance Calculation** — Accurate GPS-based distance with invalid-point filtering
- **Pause/Resume** — Pause your run without counting paused time or distance
- **Screen Wake Lock** — Keeps the screen on during active runs (when browser supports it)
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
3. Create `.env.local` with your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   USER_SECRET_ENCRYPTION_KEY=<64-char hex string>
   ```
   Generate the encryption key with:
   ```bash
   openssl rand -hex 32
   ```
4. Run the database schema:
   - **Fresh install**: Run `supabase/schema.sql` in the Supabase SQL Editor
   - **Existing V1 database**: Run migrations in order:
     1. `supabase/migrations/002_v2_features.sql`
     2. `supabase/migrations/003_v2_ai_admin.sql`
5. Start the dev server:
   ```bash
   npm run dev
   ```

### V2 Migration (Existing Databases)

If you already have the V1 schema, run the migration files in order:

```sql
-- 1. Run supabase/migrations/002_v2_features.sql
--    Creates exercise_library, run tracking, exercise picker, etc.

-- 2. Run supabase/migrations/003_v2_ai_admin.sql
--    Adds admin roles, user_api_keys, admin RLS policies
```

**Migration 003 specifically:**
- Adds `role` column to `profiles` (default: `'user'`)
- Sets `charles.camisasca@gmail.com` as the initial admin
- Creates `user_api_keys` table for encrypted API key storage
- Adds admin RLS policies for global exercise management
- Creates `is_admin()` helper function

**No existing data is modified or deleted.**

### Making Yourself Admin

The migration automatically sets `charles.camisasca@gmail.com` as admin. To make a different user admin:

```sql
UPDATE public.profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

## AI Workout Builder

### How It Works
1. User provides their own OpenAI API key in Settings
2. User describes a workout in natural language
3. Server fetches the exercise library, calls OpenAI with the user's key
4. AI returns a structured workout proposal
5. User can review, modify conversationally, or save directly
6. Saved workouts behave identically to manually-created workouts

### API Key Storage
- Keys are encrypted with **AES-256-GCM** using a server-only encryption key (`USER_SECRET_ENCRYPTION_KEY`)
- The encrypted value is stored in `user_api_keys` with RLS (users can only access their own)
- Decryption happens only server-side in the `/api/ai/workout` route handler
- The browser never sees the decrypted key after saving

### Billing
**Each user is responsible for their own OpenAI API usage and charges.** The application does not include a shared API key. If `USER_SECRET_ENCRYPTION_KEY` is not set, AI features will show a server error when saving a key.

### AI Model
The AI Workout Builder uses `gpt-4o-mini` for cost efficiency. This is configurable in `src/app/api/ai/workout/route.ts`.

## GPS / Run Tracking Notes

- GPS requires **HTTPS** — Vercel deployment provides this automatically
- `localhost` works for development (browsers allow geolocation on localhost)
- Location permission is requested only when starting a run, not on app load
- GPS accuracy filtering: points with accuracy > 50m are ignored
- Speed filtering: movements > 30 mph are filtered as GPS errors
- GPS data is stored as JSONB in the session record, not on every update
- GPS data is protected by Supabase Row Level Security
- **Browser limitation**: GPS may stop tracking if the browser tab loses focus or the phone is locked. The Screen Wake Lock API is used to prevent the screen from sleeping during active runs.

## Project Structure

```
src/
├── app/
│   ├── (app)/                  # Authenticated routes
│   │   ├── admin/exercises/    # Admin global exercise management
│   │   ├── dashboard/          # Main dashboard
│   │   ├── exercises/          # Exercise library
│   │   ├── history/            # Workout history
│   │   ├── settings/           # User settings + AI key management
│   │   ├── workout/            # Active workout/run player
│   │   └── workouts/
│   │       ├── ai/             # AI Workout Builder
│   │       └── ...             # Template CRUD
│   ├── api/ai/
│   │   ├── keys/               # API key management endpoint
│   │   └── workout/            # AI workout generation endpoint
│   ├── auth/                   # OAuth callback
│   ├── login/
│   └── signup/
├── components/
│   ├── ui/                     # Reusable UI primitives
│   ├── ai-workout-builder.tsx  # Conversational AI builder
│   ├── ai-settings.tsx         # API key management UI
│   ├── admin-exercise-manager.tsx
│   ├── exercise-picker.tsx     # Library exercise search
│   ├── run-tracker.tsx         # GPS run tracking UI
│   └── ...
├── hooks/
└── lib/
    ├── supabase/               # Supabase client/server helpers
    ├── crypto.ts               # AES-256-GCM encryption
    ├── gps.ts                  # Haversine, GPS validation
    ├── types.ts                # TypeScript types
    └── ...

supabase/
├── schema.sql                  # Full database schema (V2 complete)
└── migrations/
    ├── 002_v2_features.sql     # Exercise library, runs, performance
    └── 003_v2_ai_admin.sql     # Admin roles, API keys, admin RLS
```

## Environment Variables

| Variable | Required | Exposed to Browser | Description |
|----------|----------|--------------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes | Your Supabase anonymous/public key |
| `USER_SECRET_ENCRYPTION_KEY` | For AI | **No** | 64-char hex string for API key encryption |

No service-role keys are exposed to the browser. All data access is governed by RLS policies.

## Security

- **Row Level Security** enforced on all tables
- **Admin role** checked in database RLS, not just client-side
- **API keys** encrypted with AES-256-GCM, server-only decryption
- **GPS data** protected by RLS; users can only access their own
- **No NEXT_PUBLIC_ secrets** — only the Supabase URL and anon key are browser-visible
- **Supabase service-role key** is never used in client code
