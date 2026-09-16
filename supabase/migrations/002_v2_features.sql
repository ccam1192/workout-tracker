-- V2 Migration: Exercise Library, Run Tracker, Performance Indexes
-- This migration is additive and safe to run on an existing database.

-- ---------------------------------------------------------------------------
-- 1. Exercise Library table
-- ---------------------------------------------------------------------------

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

drop trigger if exists exercise_library_set_updated_at on public.exercise_library;
create trigger exercise_library_set_updated_at
  before update on public.exercise_library
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Exercise Library indexes
-- ---------------------------------------------------------------------------

create index if not exists exercise_library_user_id_idx
  on public.exercise_library (user_id);

create index if not exists exercise_library_system_idx
  on public.exercise_library (is_system_exercise)
  where is_system_exercise = true;

create index if not exists exercise_library_category_idx
  on public.exercise_library (category);

create index if not exists exercise_library_name_idx
  on public.exercise_library (lower(name));

-- ---------------------------------------------------------------------------
-- 3. Exercise Library RLS
-- ---------------------------------------------------------------------------

alter table public.exercise_library enable row level security;

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

-- ---------------------------------------------------------------------------
-- 4. Exercise Library grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.exercise_library to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Add exercise_library_id to workout_template_exercises
-- ---------------------------------------------------------------------------

alter table public.workout_template_exercises
  add column if not exists exercise_library_id uuid references public.exercise_library (id) on delete set null;

create index if not exists workout_template_exercises_library_id_idx
  on public.workout_template_exercises (exercise_library_id);

-- ---------------------------------------------------------------------------
-- 6. Extend workout_sessions for runs
-- ---------------------------------------------------------------------------

alter table public.workout_sessions
  drop constraint if exists workout_sessions_workout_type_check;
alter table public.workout_sessions
  add constraint workout_sessions_workout_type_check
  check (workout_type in ('standard', 'circuit', 'run'));

alter table public.workout_templates
  drop constraint if exists workout_templates_workout_type_check;
alter table public.workout_templates
  add constraint workout_templates_workout_type_check
  check (workout_type in ('standard', 'circuit', 'run'));

alter table public.workout_sessions
  add column if not exists distance numeric,
  add column if not exists distance_unit text default 'mi',
  add column if not exists active_duration_seconds integer,
  add column if not exists gps_data jsonb;

-- ---------------------------------------------------------------------------
-- 7. Start run session function
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

grant execute on function public.start_run_session(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Complete run session function
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

grant execute on function public.complete_run_session(uuid, numeric, text, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Additional performance indexes
-- ---------------------------------------------------------------------------

create index if not exists workout_sessions_type_idx
  on public.workout_sessions (user_id, workout_type);

create index if not exists workout_sessions_completed_at_idx
  on public.workout_sessions (completed_at desc)
  where status = 'completed';

-- ---------------------------------------------------------------------------
-- 10. Seed 50 system exercises (only if none exist yet)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from public.exercise_library where is_system_exercise = true limit 1) then

    insert into public.exercise_library (
      name, category, description, form_instructions, primary_muscles, equipment,
      exercise_type, default_repetitions, default_duration_seconds, is_system_exercise
    ) values
    -- CALISTHENICS / BODYWEIGHT (25)
    (
      'Push-Ups', 'Calisthenics',
      'A foundational upper-body pushing exercise using bodyweight.',
      'Start in a plank with hands slightly wider than shoulder width. Brace your core, lower your body under control until your chest is near the floor, then press back up while maintaining a straight body position.',
      'Chest, shoulders, triceps', 'None', 'bodyweight', '10-15', null, true
    ),
    (
      'Incline Push-Ups', 'Calisthenics',
      'A push-up variation with hands elevated, reducing difficulty.',
      'Place your hands on a bench or elevated surface. Keep your body straight, lower your chest toward the surface, then push back up. Great for beginners or warm-ups.',
      'Chest, shoulders, triceps', 'Bench or elevated surface', 'bodyweight', '12-15', null, true
    ),
    (
      'Decline Push-Ups', 'Calisthenics',
      'A push-up variation with feet elevated, increasing upper chest and shoulder emphasis.',
      'Place your feet on a bench or step and hands on the floor. Keep your core tight and lower your chest to the ground, then press back up.',
      'Upper chest, shoulders, triceps', 'Bench or step', 'bodyweight', '8-12', null, true
    ),
    (
      'Diamond Push-Ups', 'Calisthenics',
      'A narrow-grip push-up variation emphasizing the triceps.',
      'Place your hands close together under your chest, forming a diamond shape with your thumbs and index fingers. Lower with control and press back up, keeping elbows close to your body.',
      'Triceps, chest, shoulders', 'None', 'bodyweight', '8-12', null, true
    ),
    (
      'Pike Push-Ups', 'Calisthenics',
      'A push-up variation that emphasizes the shoulders by positioning hips high.',
      'Start in a downward-dog position with hips elevated. Bend your elbows and lower your head toward the floor, then press back up. Keep your legs as straight as comfortable.',
      'Shoulders, triceps, upper chest', 'None', 'bodyweight', '8-12', null, true
    ),
    (
      'Pull-Ups', 'Calisthenics',
      'An upper-body pulling exercise using an overhand grip on a bar.',
      'Hang from a bar with an overhand grip slightly wider than shoulder width. Pull your chin above the bar by driving your elbows down and back, then lower with control.',
      'Lats, biceps, upper back', 'Pull-up bar', 'bodyweight', '5-10', null, true
    ),
    (
      'Chin-Ups', 'Calisthenics',
      'A pull-up variation using an underhand grip to increase biceps involvement.',
      'Hang from a bar with an underhand (supinated) grip at shoulder width. Pull your chin above the bar, squeezing your biceps and back, then lower with control.',
      'Biceps, lats, upper back', 'Pull-up bar', 'bodyweight', '5-10', null, true
    ),
    (
      'Assisted Pull-Ups', 'Calisthenics',
      'A pull-up using a resistance band or machine for support.',
      'Loop a resistance band over the bar and place your foot or knee in it. Perform pull-ups as normal, allowing the band to assist you through the movement.',
      'Lats, biceps, upper back', 'Pull-up bar, resistance band', 'bodyweight', '8-12', null, true
    ),
    (
      'Dips', 'Calisthenics',
      'An upper-body pushing exercise using parallel bars.',
      'Support yourself on parallel bars with arms straight. Lower your body by bending your elbows until your upper arms are roughly parallel to the floor, then press back up. Keep a slight forward lean.',
      'Chest, triceps, shoulders', 'Parallel bars or dip station', 'bodyweight', '8-12', null, true
    ),
    (
      'Bodyweight Squats', 'Calisthenics',
      'A fundamental lower-body exercise using only bodyweight.',
      'Stand with feet shoulder-width apart. Keep your chest up, sit your hips back and down until your thighs are at least parallel to the floor, then drive through your feet to stand.',
      'Quads, glutes, hamstrings', 'None', 'bodyweight', '15-20', null, true
    ),
    (
      'Jump Squats', 'Calisthenics',
      'An explosive bodyweight squat variation that builds power.',
      'Perform a bodyweight squat, then explode upward into a jump. Land softly with knees slightly bent and immediately descend into the next rep.',
      'Quads, glutes, calves', 'None', 'bodyweight', '10-15', null, true
    ),
    (
      'Walking Lunges', 'Calisthenics',
      'A dynamic lower-body exercise that works each leg alternately.',
      'Take a controlled step forward and lower your back knee toward the ground. Push off the front foot and step forward into the next lunge. Keep the front knee tracking over the foot.',
      'Quads, glutes, hamstrings', 'None', 'bodyweight', '10 each leg', null, true
    ),
    (
      'Reverse Lunges', 'Calisthenics',
      'A lunge variation stepping backward, which can be easier on the knees.',
      'Step one foot backward and lower your back knee toward the floor. Push through the front foot to return to standing. Alternate legs each rep.',
      'Quads, glutes, hamstrings', 'None', 'bodyweight', '10 each leg', null, true
    ),
    (
      'Bulgarian Split Squats', 'Calisthenics',
      'A single-leg squat variation with the rear foot elevated.',
      'Stand in a split stance with your rear foot on a bench behind you. Lower your body until your front thigh is roughly parallel to the floor, then drive back up. Keep your torso upright.',
      'Quads, glutes, hamstrings', 'Bench or step', 'bodyweight', '8-10 each leg', null, true
    ),
    (
      'Step-Ups', 'Calisthenics',
      'A unilateral lower-body exercise using a bench or step.',
      'Place one foot on a bench or step. Drive through that foot to stand on top of the bench, then step back down under control. Complete all reps on one side before switching.',
      'Quads, glutes', 'Bench or step', 'bodyweight', '10 each leg', null, true
    ),
    (
      'Glute Bridges', 'Calisthenics',
      'A hip extension exercise that targets the glutes.',
      'Lie on your back with knees bent and feet flat on the floor. Drive through your heels and squeeze your glutes to lift your hips until your body forms a straight line from shoulders to knees. Lower with control.',
      'Glutes, hamstrings', 'None', 'bodyweight', '15-20', null, true
    ),
    (
      'Single-Leg Glute Bridges', 'Calisthenics',
      'A unilateral glute bridge variation for increased difficulty.',
      'Perform a glute bridge with one leg extended straight or held off the ground. Drive through the planted foot and squeeze the glute at the top. Lower with control.',
      'Glutes, hamstrings', 'None', 'bodyweight', '10 each leg', null, true
    ),
    (
      'Calf Raises', 'Calisthenics',
      'An isolation exercise for the calf muscles.',
      'Stand on the edge of a step or flat on the floor. Rise onto your toes as high as possible, pause briefly at the top, then lower your heels with control.',
      'Calves', 'None or step', 'bodyweight', '15-20', null, true
    ),
    (
      'Plank', 'Calisthenics',
      'An isometric core exercise that builds abdominal and trunk stability.',
      'Hold a forearm or straight-arm plank position. Keep your body in a straight line from head to heels. Brace your core and avoid letting your hips sag or pike up.',
      'Core, shoulders', 'None', 'bodyweight', null, 45, true
    ),
    (
      'Side Plank', 'Calisthenics',
      'A lateral core stability exercise.',
      'Lie on one side and prop yourself up on your forearm. Stack your feet and lift your hips to form a straight line. Hold, then switch sides.',
      'Obliques, core', 'None', 'bodyweight', null, 30, true
    ),
    (
      'Dead Bug', 'Calisthenics',
      'A core stability exercise that trains anti-extension.',
      'Lie on your back with arms extended toward the ceiling and knees bent at 90 degrees. Slowly extend one arm overhead and the opposite leg straight, keeping your lower back pressed into the floor. Return and alternate.',
      'Core, deep stabilizers', 'None', 'bodyweight', '10 each side', null, true
    ),
    (
      'Mountain Climbers', 'Calisthenics',
      'A dynamic core and conditioning exercise.',
      'Start in a plank position. Alternate driving each knee toward your chest at a controlled pace. Keep your hips level and core braced throughout.',
      'Core, hip flexors, shoulders', 'None', 'bodyweight', '20-30', null, true
    ),
    (
      'Burpees', 'Calisthenics',
      'A full-body conditioning exercise combining a squat, plank, and jump.',
      'From standing, drop into a squat, place your hands on the floor, kick your feet back to a plank, then reverse the movement and jump up. Step back instead of jumping if needed for lower impact.',
      'Full body', 'None', 'bodyweight', '5-10', null, true
    ),
    (
      'Superman', 'Calisthenics',
      'A prone back extension exercise targeting the posterior chain.',
      'Lie face down with arms extended overhead. Simultaneously lift your arms, chest, and legs off the floor in a controlled manner. Hold briefly, then lower. Focus on gentle activation.',
      'Lower back, glutes, upper back', 'None', 'bodyweight', '10-15', null, true
    ),
    (
      'Hollow Body Hold', 'Calisthenics',
      'An isometric core exercise that builds anterior core strength.',
      'Lie on your back. Press your lower back into the floor, lift your shoulders and legs slightly off the ground, and extend your arms overhead. Hold this position while keeping your core braced.',
      'Core, hip flexors', 'None', 'bodyweight', null, 30, true
    ),

    -- WEIGHT TRAINING (25)
    (
      'Barbell Back Squat', 'Weight Training',
      'A fundamental compound lower-body exercise with a barbell on the upper back.',
      'Position the barbell on your upper traps. Unrack and step back. Squat down by sitting your hips back and bending your knees until your thighs are at least parallel, then drive through your feet to stand.',
      'Quads, glutes, hamstrings, core', 'Barbell, squat rack', 'barbell', '8-12', null, true
    ),
    (
      'Barbell Front Squat', 'Weight Training',
      'A squat variation with the barbell held in front of the shoulders.',
      'Hold the barbell across your front deltoids with elbows high. Keep your torso upright as you squat to at least parallel depth, then stand back up.',
      'Quads, glutes, core', 'Barbell, squat rack', 'barbell', '6-10', null, true
    ),
    (
      'Goblet Squat', 'Weight Training',
      'A squat variation holding a dumbbell or kettlebell at the chest.',
      'Hold a dumbbell or kettlebell close to your chest with both hands. Squat down with your elbows tracking inside your knees, then stand back up. Great for learning squat mechanics.',
      'Quads, glutes, core', 'Dumbbell or kettlebell', 'dumbbell', '10-15', null, true
    ),
    (
      'Romanian Deadlift', 'Weight Training',
      'A hip-hinge exercise emphasizing the hamstrings and glutes with a barbell.',
      'Hold a barbell at hip height with a shoulder-width grip. Push your hips back and lower the bar along your legs, keeping a slight knee bend and flat back. Reverse when you feel a stretch in your hamstrings.',
      'Hamstrings, glutes, lower back', 'Barbell', 'barbell', '8-12', null, true
    ),
    (
      'Conventional Deadlift', 'Weight Training',
      'A full-body compound lift pulling a barbell from the floor.',
      'Stand with feet hip-width apart, barbell over mid-foot. Grip the bar just outside your legs. Brace your core, keep your back flat, and drive through your feet to stand up with the bar.',
      'Hamstrings, glutes, back, core', 'Barbell', 'barbell', '5-8', null, true
    ),
    (
      'Barbell Bench Press', 'Weight Training',
      'A primary upper-body pressing exercise on a flat bench.',
      'Lie on a flat bench, grip the barbell slightly wider than shoulder width. Unrack and lower the bar to your mid-chest under control, then press it back up to full lockout.',
      'Chest, shoulders, triceps', 'Barbell, bench', 'barbell', '8-12', null, true
    ),
    (
      'Incline Dumbbell Bench Press', 'Weight Training',
      'A bench press variation on an incline to emphasize the upper chest.',
      'Set a bench to about 30-45 degrees. Press dumbbells from shoulder level upward until arms are extended, then lower with control.',
      'Upper chest, shoulders, triceps', 'Dumbbells, adjustable bench', 'dumbbell', '8-12', null, true
    ),
    (
      'Dumbbell Bench Press', 'Weight Training',
      'A flat bench press using dumbbells for independent arm movement.',
      'Lie on a flat bench holding a dumbbell in each hand at chest level. Press both dumbbells upward until your arms are extended, then lower with control.',
      'Chest, shoulders, triceps', 'Dumbbells, bench', 'dumbbell', '8-12', null, true
    ),
    (
      'Dumbbell Shoulder Press', 'Weight Training',
      'A seated or standing overhead press with dumbbells.',
      'Hold dumbbells at shoulder height with palms facing forward. Press them overhead until your arms are fully extended, then lower with control.',
      'Shoulders, triceps', 'Dumbbells', 'dumbbell', '8-12', null, true
    ),
    (
      'Barbell Overhead Press', 'Weight Training',
      'A standing barbell press overhead for shoulder strength.',
      'Hold a barbell at shoulder height with a grip just outside shoulder width. Brace your core and press the bar straight overhead. Lower with control back to the starting position.',
      'Shoulders, triceps, core', 'Barbell', 'barbell', '6-10', null, true
    ),
    (
      'Dumbbell Lateral Raise', 'Weight Training',
      'An isolation exercise for the side deltoids.',
      'Hold dumbbells at your sides. Raise your arms out to the sides until they are roughly parallel with the floor, keeping a slight bend in the elbows. Lower with control.',
      'Side deltoids', 'Dumbbells', 'dumbbell', '12-15', null, true
    ),
    (
      'Barbell Bent-Over Row', 'Weight Training',
      'A compound pulling exercise for the back using a barbell.',
      'Hinge at the hips with a flat back, holding a barbell with an overhand grip. Pull the bar to your lower chest or upper abdomen, squeezing your shoulder blades together, then lower with control.',
      'Lats, upper back, biceps', 'Barbell', 'barbell', '8-12', null, true
    ),
    (
      'One-Arm Dumbbell Row', 'Weight Training',
      'A unilateral back exercise using a dumbbell and bench for support.',
      'Place one hand and knee on a bench, holding a dumbbell in the other hand. Row the dumbbell to your hip, squeezing your back at the top, then lower with control.',
      'Lats, upper back, biceps', 'Dumbbell, bench', 'dumbbell', '8-12 each side', null, true
    ),
    (
      'Seated Cable Row', 'Weight Training',
      'A back exercise using a cable machine in a seated position.',
      'Sit at a cable row station with feet on the footrests and knees slightly bent. Pull the handle to your torso, squeezing your shoulder blades together, then extend your arms with control.',
      'Lats, upper back, biceps', 'Cable machine', 'cable', '10-15', null, true
    ),
    (
      'Lat Pulldown', 'Weight Training',
      'A cable machine exercise that mimics the pull-up movement pattern.',
      'Sit at a lat pulldown station and grip the bar slightly wider than shoulder width. Pull the bar down to your upper chest, squeezing your lats, then let it return with control.',
      'Lats, biceps, upper back', 'Cable machine', 'cable', '10-12', null, true
    ),
    (
      'Barbell Hip Thrust', 'Weight Training',
      'A glute-focused hip extension exercise using a barbell.',
      'Sit on the floor with your upper back against a bench and a barbell across your hips. Drive through your heels to extend your hips until your body forms a straight line from shoulders to knees.',
      'Glutes, hamstrings', 'Barbell, bench', 'barbell', '8-12', null, true
    ),
    (
      'Dumbbell Romanian Deadlift', 'Weight Training',
      'A hip-hinge exercise using dumbbells, similar to the barbell RDL.',
      'Hold dumbbells in front of your thighs. Push your hips back while lowering the weights along your legs, maintaining a flat back and slight knee bend. Reverse when you feel the hamstring stretch.',
      'Hamstrings, glutes, lower back', 'Dumbbells', 'dumbbell', '10-12', null, true
    ),
    (
      'Leg Press', 'Weight Training',
      'A machine-based lower-body pressing exercise.',
      'Sit in the leg press machine with feet shoulder-width apart on the platform. Lower the platform under control until your knees reach about 90 degrees, then press back up without locking your knees.',
      'Quads, glutes', 'Leg press machine', 'machine', '10-15', null, true
    ),
    (
      'Leg Curl', 'Weight Training',
      'A machine-based exercise isolating the hamstrings.',
      'Lie face down on a leg curl machine with the pad behind your ankles. Curl your heels toward your glutes, squeezing your hamstrings, then lower with control.',
      'Hamstrings', 'Leg curl machine', 'machine', '10-15', null, true
    ),
    (
      'Leg Extension', 'Weight Training',
      'A machine-based exercise isolating the quadriceps.',
      'Sit on a leg extension machine with the pad on your shins. Extend your legs until they are straight, squeezing your quads at the top, then lower with control.',
      'Quads', 'Leg extension machine', 'machine', '10-15', null, true
    ),
    (
      'Dumbbell Biceps Curl', 'Weight Training',
      'A classic isolation exercise for the biceps.',
      'Hold dumbbells at your sides with palms facing forward. Curl the weights toward your shoulders by bending your elbows, then lower with control. Avoid swinging.',
      'Biceps', 'Dumbbells', 'dumbbell', '10-15', null, true
    ),
    (
      'Hammer Curl', 'Weight Training',
      'A biceps curl variation with a neutral grip that also targets the forearms.',
      'Hold dumbbells at your sides with palms facing each other (neutral grip). Curl the weights toward your shoulders, then lower with control.',
      'Biceps, brachioradialis', 'Dumbbells', 'dumbbell', '10-15', null, true
    ),
    (
      'Triceps Pushdown', 'Weight Training',
      'A cable exercise isolating the triceps.',
      'Stand at a cable station with a straight bar or rope attached at the top. Push the handle down by extending your elbows until your arms are straight, then return with control. Keep your elbows pinned to your sides.',
      'Triceps', 'Cable machine', 'cable', '12-15', null, true
    ),
    (
      'Skull Crushers', 'Weight Training',
      'A lying triceps extension exercise using a barbell or dumbbells.',
      'Lie on a bench holding a barbell or EZ-bar with arms extended above your chest. Lower the weight toward your forehead by bending your elbows, then extend back up. Keep your upper arms stationary.',
      'Triceps', 'Barbell or EZ-bar, bench', 'barbell', '8-12', null, true
    ),
    (
      'Dumbbell Fly', 'Weight Training',
      'A chest isolation exercise performed on a flat bench.',
      'Lie on a flat bench holding dumbbells above your chest with a slight bend in your elbows. Lower the weights out to the sides in a wide arc until you feel a stretch in your chest, then squeeze them back together.',
      'Chest', 'Dumbbells, bench', 'dumbbell', '10-12', null, true
    );

  end if;
end;
$$;
