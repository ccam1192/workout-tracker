-- Workout Tracker schema (V2)
-- Paste this into the Supabase SQL Editor and run it.
-- For existing databases, use supabase/migrations/002_v2_features.sql instead.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Exercise Library: reusable exercise definitions
-- user_id = NULL + is_system_exercise = true → built-in exercise visible to all
-- user_id = <uuid> + is_system_exercise = false → user's personal exercise
create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  description text,
  form_instructions text,
  primary_muscles text,
  equipment text,
  exercise_type text not null default 'bodyweight'
    check (exercise_type in ('bodyweight', 'barbell', 'dumbbell', 'machine', 'cable', 'other')),
  default_repetitions text,
  default_duration_seconds integer,
  default_weight numeric,
  default_weight_unit text,
  default_rest_seconds integer,
  video_url text,
  is_system_exercise boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  workout_type text not null default 'standard'
    check (workout_type in ('standard', 'circuit', 'run')),
  rounds integer default 1 check (rounds is null or rounds >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workout-specific exercise configuration. References library for provenance,
-- but stores its own name/settings so the workout is independent of library edits.
create table if not exists public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_library_id uuid references public.exercise_library (id) on delete set null,
  exercise_order integer not null default 1,
  name text not null,
  sets integer,
  repetitions text,
  duration_seconds integer,
  weight numeric,
  weight_unit text,
  rest_seconds integer,
  notes text,
  video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workout sessions: standard/circuit exercise sessions and runs
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  workout_date date not null,
  template_name text not null,
  workout_type text not null default 'standard'
    check (workout_type in ('standard', 'circuit', 'run')),
  rounds integer not null default 1,
  duration_seconds integer,
  -- Run-specific fields
  distance numeric,
  distance_unit text default 'mi',
  active_duration_seconds integer,
  gps_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_session_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  round_number integer not null,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  paused_seconds integer not null default 0,
  unique (session_id, round_number)
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  template_exercise_id uuid references public.workout_template_exercises (id) on delete set null,
  exercise_order integer not null default 1,
  round_number integer not null default 1,
  set_number integer not null default 1,
  completed boolean not null default false,
  completed_at timestamptz,
  repetitions_completed integer,
  duration_seconds_completed integer,
  weight_used numeric,
  notes text,
  name text not null,
  sets integer,
  repetitions text,
  duration_seconds integer,
  weight numeric,
  weight_unit text,
  rest_seconds integer,
  video_url text
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists exercise_library_user_id_idx
  on public.exercise_library (user_id);
create index if not exists exercise_library_system_idx
  on public.exercise_library (is_system_exercise) where is_system_exercise = true;
create index if not exists exercise_library_category_idx
  on public.exercise_library (category);
create index if not exists exercise_library_name_idx
  on public.exercise_library (lower(name));

create index if not exists workout_templates_user_id_idx
  on public.workout_templates (user_id);

create index if not exists workout_template_exercises_template_id_idx
  on public.workout_template_exercises (template_id, exercise_order);
create index if not exists workout_template_exercises_library_id_idx
  on public.workout_template_exercises (exercise_library_id);

create index if not exists workout_sessions_user_id_idx
  on public.workout_sessions (user_id, workout_date desc);
create index if not exists workout_sessions_status_idx
  on public.workout_sessions (user_id, status);
create index if not exists workout_sessions_type_idx
  on public.workout_sessions (user_id, workout_type);
create index if not exists workout_sessions_completed_at_idx
  on public.workout_sessions (completed_at desc) where status = 'completed';

create index if not exists workout_session_exercises_session_id_idx
  on public.workout_session_exercises (session_id, round_number, exercise_order, set_number);

create index if not exists workout_session_rounds_session_id_idx
  on public.workout_session_rounds (session_id, round_number);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workout_templates_set_updated_at on public.workout_templates;
create trigger workout_templates_set_updated_at
  before update on public.workout_templates
  for each row execute function public.set_updated_at();

drop trigger if exists workout_template_exercises_set_updated_at on public.workout_template_exercises;
create trigger workout_template_exercises_set_updated_at
  before update on public.workout_template_exercises
  for each row execute function public.set_updated_at();

drop trigger if exists exercise_library_set_updated_at on public.exercise_library;
create trigger exercise_library_set_updated_at
  before update on public.exercise_library
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New user -> profile
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Starter workout (per user, only when they have zero templates)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_starter_workout()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select count(*) into v_count
  from public.workout_templates
  where user_id = v_user_id;

  if v_count > 0 then
    select id into v_template_id
    from public.workout_templates
    where user_id = v_user_id
    order by created_at
    limit 1;
    return v_template_id;
  end if;

  insert into public.workout_templates (
    user_id, name, description, workout_type, rounds
  ) values (
    v_user_id,
    'Morning Calisthenics',
    'A simple full-body bodyweight circuit to build strength, mobility, conditioning, and general fitness.',
    'circuit',
    3
  )
  returning id into v_template_id;

  insert into public.workout_template_exercises (
    template_id, exercise_order, name, repetitions, duration_seconds, notes
  ) values
    (
      v_template_id, 1, 'Push-Ups', '10-15', null,
      'Keep your body straight, brace your core, and lower your chest under control. Modify with knees elevated if needed.'
    ),
    (
      v_template_id, 2, 'Bodyweight Squats', '15-20', null,
      'Keep your chest up, sit your hips back, and drive through your feet. Aim for comfortable depth with good form.'
    ),
    (
      v_template_id, 3, 'Walking Lunges', '10 each leg', null,
      'Take controlled steps and keep the front knee tracking over the foot.'
    ),
    (
      v_template_id, 4, 'Pike Push-Ups', '8-12', null,
      'Keep your hips elevated and lower your head toward the floor with control. This emphasizes the shoulders.'
    ),
    (
      v_template_id, 5, 'Glute Bridges', '15-20', null,
      'Drive through your heels and squeeze your glutes at the top without overextending your lower back.'
    ),
    (
      v_template_id, 6, 'Plank', null, 45,
      'Hold for 30–45 seconds. Keep your body in a straight line and brace your core. Stop if your lower back begins to sag.'
    ),
    (
      v_template_id, 7, 'Superman', '10-15', null,
      'Lift your arms and legs in a controlled manner. Focus on gentle activation rather than aggressively arching your back.'
    ),
    (
      v_template_id, 8, 'Burpees', '5-10', null,
      'Perform at a controlled pace. Step back/forward instead of jumping if needed.'
    );

  return v_template_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start a workout session and snapshot template exercises
-- ---------------------------------------------------------------------------

create or replace function public.start_workout_session(
  p_template_id uuid,
  p_workout_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_template public.workout_templates%rowtype;
  v_exercise public.workout_template_exercises%rowtype;
  v_round integer;
  v_set integer;
  v_sets integer;
  v_rounds integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_template
  from public.workout_templates
  where id = p_template_id and user_id = v_user_id;

  if not found then
    raise exception 'Template not found';
  end if;

  v_rounds := coalesce(v_template.rounds, 1);

  insert into public.workout_sessions (
    user_id,
    template_id,
    started_at,
    status,
    workout_date,
    template_name,
    workout_type,
    rounds
  ) values (
    v_user_id,
    p_template_id,
    now(),
    'in_progress',
    p_workout_date,
    v_template.name,
    v_template.workout_type,
    v_rounds
  )
  returning id into v_session_id;

  if v_template.workout_type = 'circuit' then
    for v_round in 1..v_rounds loop
      insert into public.workout_session_rounds (session_id, round_number, started_at)
      values (v_session_id, v_round, case when v_round = 1 then now() else null end);

      for v_exercise in
        select *
        from public.workout_template_exercises
        where template_id = p_template_id
        order by exercise_order
      loop
        insert into public.workout_session_exercises (
          session_id,
          template_exercise_id,
          exercise_order,
          round_number,
          set_number,
          completed,
          name,
          sets,
          repetitions,
          duration_seconds,
          weight,
          weight_unit,
          rest_seconds,
          notes,
          video_url
        ) values (
          v_session_id,
          v_exercise.id,
          v_exercise.exercise_order,
          v_round,
          1,
          false,
          v_exercise.name,
          v_exercise.sets,
          v_exercise.repetitions,
          v_exercise.duration_seconds,
          v_exercise.weight,
          v_exercise.weight_unit,
          v_exercise.rest_seconds,
          v_exercise.notes,
          v_exercise.video_url
        );
      end loop;
    end loop;
  else
    insert into public.workout_session_rounds (session_id, round_number, started_at)
    values (v_session_id, 1, now());

    for v_exercise in
      select *
      from public.workout_template_exercises
      where template_id = p_template_id
      order by exercise_order
    loop
      v_sets := greatest(coalesce(v_exercise.sets, 1), 1);
      for v_set in 1..v_sets loop
        insert into public.workout_session_exercises (
          session_id,
          template_exercise_id,
          exercise_order,
          round_number,
          set_number,
          completed,
          name,
          sets,
          repetitions,
          duration_seconds,
          weight,
          weight_unit,
          rest_seconds,
          notes,
          video_url
        ) values (
          v_session_id,
          v_exercise.id,
          v_exercise.exercise_order,
          1,
          v_set,
          false,
          v_exercise.name,
          v_exercise.sets,
          v_exercise.repetitions,
          v_exercise.duration_seconds,
          v_exercise.weight,
          v_exercise.weight_unit,
          v_exercise.rest_seconds,
          v_exercise.notes,
          v_exercise.video_url
        );
      end loop;
    end loop;
  end if;

  return v_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Complete a workout session
-- ---------------------------------------------------------------------------

create or replace function public.complete_workout_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_started_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select started_at into v_started_at
  from public.workout_sessions
  where id = p_session_id and user_id = v_user_id;

  if not found then
    raise exception 'Session not found';
  end if;

  update public.workout_sessions
  set
    status = 'completed',
    completed_at = now(),
    duration_seconds = greatest(0, floor(extract(epoch from (now() - v_started_at)))::integer)
  where id = p_session_id and user_id = v_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start a run session
-- ---------------------------------------------------------------------------

create or replace function public.start_run_session(p_workout_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.workout_sessions (
    user_id, started_at, status, workout_date,
    template_name, workout_type, rounds
  ) values (
    v_user_id, now(), 'in_progress', p_workout_date,
    'Run', 'run', 1
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Complete a run session
-- ---------------------------------------------------------------------------

create or replace function public.complete_run_session(
  p_session_id uuid,
  p_distance numeric,
  p_distance_unit text,
  p_active_duration_seconds integer,
  p_gps_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.workout_sessions
  set
    status = 'completed',
    completed_at = now(),
    duration_seconds = p_active_duration_seconds,
    distance = p_distance,
    distance_unit = p_distance_unit,
    active_duration_seconds = p_active_duration_seconds,
    gps_data = p_gps_data
  where id = p_session_id and user_id = v_user_id and workout_type = 'run';

  if not found then
    raise exception 'Session not found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.exercise_library enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_session_rounds enable row level security;

-- Profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- Exercise Library
drop policy if exists "Users can view system exercises" on public.exercise_library;
create policy "Users can view system exercises"
  on public.exercise_library for select
  using (is_system_exercise = true);

drop policy if exists "Users can view own exercises" on public.exercise_library;
create policy "Users can view own exercises"
  on public.exercise_library for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own exercises" on public.exercise_library;
create policy "Users can insert own exercises"
  on public.exercise_library for insert
  with check (user_id = auth.uid() and is_system_exercise = false);

drop policy if exists "Users can update own exercises" on public.exercise_library;
create policy "Users can update own exercises"
  on public.exercise_library for update
  using (user_id = auth.uid() and is_system_exercise = false)
  with check (user_id = auth.uid() and is_system_exercise = false);

drop policy if exists "Users can delete own exercises" on public.exercise_library;
create policy "Users can delete own exercises"
  on public.exercise_library for delete
  using (user_id = auth.uid() and is_system_exercise = false);

-- Workout Templates
drop policy if exists "Users can view own templates" on public.workout_templates;
create policy "Users can view own templates"
  on public.workout_templates for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own templates" on public.workout_templates;
create policy "Users can insert own templates"
  on public.workout_templates for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own templates" on public.workout_templates;
create policy "Users can update own templates"
  on public.workout_templates for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own templates" on public.workout_templates;
create policy "Users can delete own templates"
  on public.workout_templates for delete
  using (user_id = auth.uid());

-- Workout Template Exercises
drop policy if exists "Users can view own template exercises" on public.workout_template_exercises;
create policy "Users can view own template exercises"
  on public.workout_template_exercises for select
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own template exercises" on public.workout_template_exercises;
create policy "Users can insert own template exercises"
  on public.workout_template_exercises for insert
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own template exercises" on public.workout_template_exercises;
create policy "Users can update own template exercises"
  on public.workout_template_exercises for update
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own template exercises" on public.workout_template_exercises;
create policy "Users can delete own template exercises"
  on public.workout_template_exercises for delete
  using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

-- Workout Sessions
drop policy if exists "Users can view own sessions" on public.workout_sessions;
create policy "Users can view own sessions"
  on public.workout_sessions for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert own sessions" on public.workout_sessions;
create policy "Users can insert own sessions"
  on public.workout_sessions for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own sessions" on public.workout_sessions;
create policy "Users can update own sessions"
  on public.workout_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own sessions" on public.workout_sessions;
create policy "Users can delete own sessions"
  on public.workout_sessions for delete
  using (user_id = auth.uid());

-- Workout Session Exercises
drop policy if exists "Users can view own session exercises" on public.workout_session_exercises;
create policy "Users can view own session exercises"
  on public.workout_session_exercises for select
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own session exercises" on public.workout_session_exercises;
create policy "Users can insert own session exercises"
  on public.workout_session_exercises for insert
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own session exercises" on public.workout_session_exercises;
create policy "Users can update own session exercises"
  on public.workout_session_exercises for update
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own session exercises" on public.workout_session_exercises;
create policy "Users can delete own session exercises"
  on public.workout_session_exercises for delete
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- Workout Session Rounds
drop policy if exists "Users can view own session rounds" on public.workout_session_rounds;
create policy "Users can view own session rounds"
  on public.workout_session_rounds for select
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own session rounds" on public.workout_session_rounds;
create policy "Users can insert own session rounds"
  on public.workout_session_rounds for insert
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own session rounds" on public.workout_session_rounds;
create policy "Users can update own session rounds"
  on public.workout_session_rounds for update
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own session rounds" on public.workout_session_rounds;
create policy "Users can delete own session rounds"
  on public.workout_session_rounds for delete
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert on public.profiles to authenticated;
grant select, insert, update, delete on public.exercise_library to authenticated;
grant select, insert, update, delete on public.workout_templates to authenticated;
grant select, insert, update, delete on public.workout_template_exercises to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.workout_session_exercises to authenticated;
grant select, insert, update, delete on public.workout_session_rounds to authenticated;

grant execute on function public.ensure_starter_workout() to authenticated;
grant execute on function public.start_workout_session(uuid, date) to authenticated;
grant execute on function public.complete_workout_session(uuid) to authenticated;
grant execute on function public.start_run_session(date) to authenticated;
grant execute on function public.complete_run_session(uuid, numeric, text, integer, jsonb) to authenticated;
