-- V2.1 Migration: Actual workout tracking, form guidance snapshots, 100 additional global exercises
-- Additive and safe to run on an existing database. Does not drop tables or delete history.

-- ---------------------------------------------------------------------------
-- 1. Snapshot form guidance onto session exercises
-- Existing planned vs actual columns remain:
--   planned: repetitions, duration_seconds, weight, weight_unit
--   actual:  repetitions_completed, duration_seconds_completed, weight_used
-- ---------------------------------------------------------------------------

alter table public.workout_session_exercises
  add column if not exists exercise_library_id uuid references public.exercise_library (id) on delete set null;

alter table public.workout_session_exercises
  add column if not exists description text;

alter table public.workout_session_exercises
  add column if not exists form_instructions text;

alter table public.workout_session_exercises
  add column if not exists primary_muscles text;

alter table public.workout_session_exercises
  add column if not exists equipment text;

create index if not exists workout_session_exercises_library_id_idx
  on public.workout_session_exercises (exercise_library_id);

-- ---------------------------------------------------------------------------
-- 2. Snapshot library guidance and pre-fill actual values from the plan
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
  v_row record;
  v_round integer;
  v_set integer;
  v_sets integer;
  v_rounds integer;
  v_actual_reps integer;
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

      for v_row in
        select
          e.*,
          l.description as lib_description,
          l.form_instructions as lib_form_instructions,
          l.primary_muscles as lib_primary_muscles,
          l.equipment as lib_equipment
        from public.workout_template_exercises e
        left join public.exercise_library l on l.id = e.exercise_library_id
        where e.template_id = p_template_id
        order by e.exercise_order
      loop
        v_actual_reps := case
          when v_row.repetitions ~ '\d+' then (regexp_match(v_row.repetitions, '\d+'))[1]::integer
          else null
        end;

        insert into public.workout_session_exercises (
          session_id,
          template_exercise_id,
          exercise_library_id,
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
          video_url,
          description,
          form_instructions,
          primary_muscles,
          equipment,
          repetitions_completed,
          duration_seconds_completed,
          weight_used
        ) values (
          v_session_id,
          v_row.id,
          v_row.exercise_library_id,
          v_row.exercise_order,
          v_round,
          1,
          false,
          v_row.name,
          v_row.sets,
          v_row.repetitions,
          v_row.duration_seconds,
          v_row.weight,
          v_row.weight_unit,
          v_row.rest_seconds,
          v_row.notes,
          v_row.video_url,
          v_row.lib_description,
          v_row.lib_form_instructions,
          v_row.lib_primary_muscles,
          v_row.lib_equipment,
          v_actual_reps,
          v_row.duration_seconds,
          v_row.weight
        );
      end loop;
    end loop;
  else
    insert into public.workout_session_rounds (session_id, round_number, started_at)
    values (v_session_id, 1, now());

    for v_row in
      select
        e.*,
        l.description as lib_description,
        l.form_instructions as lib_form_instructions,
        l.primary_muscles as lib_primary_muscles,
        l.equipment as lib_equipment
      from public.workout_template_exercises e
      left join public.exercise_library l on l.id = e.exercise_library_id
      where e.template_id = p_template_id
      order by e.exercise_order
    loop
      v_sets := greatest(coalesce(v_row.sets, 1), 1);
      v_actual_reps := case
        when v_row.repetitions ~ '\d+' then (regexp_match(v_row.repetitions, '\d+'))[1]::integer
        else null
      end;

      for v_set in 1..v_sets loop
        insert into public.workout_session_exercises (
          session_id,
          template_exercise_id,
          exercise_library_id,
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
          video_url,
          description,
          form_instructions,
          primary_muscles,
          equipment,
          repetitions_completed,
          duration_seconds_completed,
          weight_used
        ) values (
          v_session_id,
          v_row.id,
          v_row.exercise_library_id,
          v_row.exercise_order,
          1,
          v_set,
          false,
          v_row.name,
          v_row.sets,
          v_row.repetitions,
          v_row.duration_seconds,
          v_row.weight,
          v_row.weight_unit,
          v_row.rest_seconds,
          v_row.notes,
          v_row.video_url,
          v_row.lib_description,
          v_row.lib_form_instructions,
          v_row.lib_primary_muscles,
          v_row.lib_equipment,
          v_actual_reps,
          v_row.duration_seconds,
          v_row.weight
        );
      end loop;
    end loop;
  end if;

  return v_session_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Add 100 global exercises without duplicating the original 50
-- ---------------------------------------------------------------------------

insert into public.exercise_library (
  name, category, description, form_instructions, primary_muscles, equipment,
  exercise_type, default_repetitions, default_duration_seconds, is_system_exercise
)
select
  n.name,
  n.category,
  n.description,
  n.form_instructions,
  n.primary_muscles,
  n.equipment,
  n.exercise_type,
  n.default_repetitions,
  n.default_duration_seconds,
  true
from (
  values
    (
      'Knee Push-Ups',
      'Calisthenics',
      'A beginner-friendly push-up performed from the knees to reduce load.',
      'Start in a plank, then drop your knees to the floor while keeping a straight line from head to knees. Lower your chest toward the floor and press back up. Keep your hips from sagging.',
      'Chest, shoulders, triceps',
      'None',
      'bodyweight',
      '10-15'::text,
      NULL::integer
    ),
    (
      'Close-Grip Push-Ups',
      'Calisthenics',
      'A narrow-hand push-up variation that emphasizes the triceps.',
      'Place your hands closer than shoulder width under your chest. Lower with elbows staying near your sides, then press back up. Keep your body in a straight line.',
      'Triceps, chest, shoulders',
      'None',
      'bodyweight',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Wide Push-Ups',
      'Calisthenics',
      'A push-up with a wider hand position that emphasizes the chest.',
      'Set your hands wider than shoulder width. Lower your chest toward the floor under control and press back up. Avoid letting your shoulders shrug toward your ears.',
      'Chest, shoulders, triceps',
      'None',
      'bodyweight',
      '10-15'::text,
      NULL::integer
    ),
    (
      'Archer Push-Ups',
      'Calisthenics',
      'A demanding push-up variation that shifts most of the load to one arm.',
      'Start in a wide push-up. As you lower, shift toward one hand while the other arm stays straighter. Press back to center and alternate sides. Move slowly and keep your hips level.',
      'Chest, shoulders, triceps',
      'None',
      'bodyweight',
      '5-8 each side'::text,
      NULL::integer
    ),
    (
      'Chest Dips',
      'Calisthenics',
      'A dip variation with a slight forward lean to emphasize the chest.',
      'Support yourself on parallel bars and lean your torso slightly forward. Lower until your upper arms are about parallel to the floor, then press back up. Stop if your shoulders feel pinched.',
      'Chest, triceps, shoulders',
      'Parallel bars or dip station',
      'bodyweight',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Decline Dumbbell Bench Press',
      'Weight Training',
      'A dumbbell press on a decline bench that targets the lower chest.',
      'Lie on a decline bench holding dumbbells at chest level. Press them up until your arms are extended, then lower with control. Keep your shoulder blades set against the bench.',
      'Chest, shoulders, triceps',
      'Dumbbells, decline bench',
      'dumbbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Dumbbell Incline Fly',
      'Weight Training',
      'A chest isolation exercise on an incline bench using dumbbells.',
      'Lie on a low incline bench with a slight bend in your elbows. Lower the dumbbells out to the sides until you feel a stretch, then bring them back together over your chest.',
      'Upper chest',
      'Dumbbells, adjustable bench',
      'dumbbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Cable Chest Fly',
      'Weight Training',
      'A standing or slightly bent chest fly using cables.',
      'Set the cables at chest height and step forward with a slight bend in your elbows. Bring your hands together in front of your chest, then return with control. Keep your shoulders down.',
      'Chest',
      'Cable machine',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Pec Deck',
      'Weight Training',
      'A machine chest fly that supports a stable movement path.',
      'Sit tall with your back against the pad and forearms on the pads or hands on the handles. Bring the arms together in front of your chest, then return slowly without losing contact with the pad.',
      'Chest',
      'Pec deck machine',
      'machine',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Push-Up to Shoulder Tap',
      'Calisthenics',
      'A push-up combined with alternating shoulder taps for core stability.',
      'Perform a push-up, then tap one hand to the opposite shoulder at the top. Keep your hips as still as possible. Alternate sides each tap.',
      'Chest, core, shoulders',
      'None',
      'bodyweight',
      '8-12 each side'::text,
      NULL::integer
    ),
    (
      'Dumbbell Floor Press',
      'Weight Training',
      'A pressing exercise performed on the floor, limiting range of motion.',
      'Lie on your back with knees bent, dumbbells at chest level and upper arms on the floor. Press up to lockout, then lower until your triceps touch the floor. Pause briefly before the next press.',
      'Chest, triceps, shoulders',
      'Dumbbells',
      'dumbbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Barbell Close-Grip Bench Press',
      'Weight Training',
      'A bench press with a narrower grip that emphasizes the triceps.',
      'Grip the bar slightly inside shoulder width. Lower it to your lower chest with elbows closer to your sides, then press back up. Keep your wrists stacked over the bar.',
      'Triceps, chest, shoulders',
      'Barbell, bench',
      'barbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Inverted Row',
      'Calisthenics',
      'A bodyweight row performed under a bar or sturdy table.',
      'Hang under a bar with your body straight and heels on the floor. Pull your chest to the bar, squeeze your shoulder blades, then lower with control. Bend your knees to make it easier.',
      'Upper back, lats, biceps',
      'Bar or sturdy table',
      'bodyweight',
      '8-12'::text,
      NULL::integer
    ),
    (
      'TRX Row',
      'Calisthenics',
      'A suspension row that lets you change difficulty by adjusting body angle.',
      'Hold the TRX handles with arms extended and body straight. Pull your chest toward the handles, then lower slowly. Step farther under the straps to make it harder.',
      'Upper back, lats, biceps',
      'TRX or suspension trainer',
      'other',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Chest-Supported Dumbbell Row',
      'Weight Training',
      'A row performed with the chest on an incline bench to reduce momentum.',
      'Lie face down on an incline bench holding dumbbells. Row them toward your hips, pause, then lower. Keep your neck relaxed and avoid shrugging.',
      'Lats, upper back, biceps',
      'Dumbbells, incline bench',
      'dumbbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Dumbbell Pullover',
      'Weight Training',
      'A lying exercise that stretches the lats and chest.',
      'Lie on a bench holding one dumbbell over your chest. Lower it behind your head with a slight elbow bend, then pull it back over your chest. Keep your ribs down.',
      'Lats, chest',
      'Dumbbell, bench',
      'dumbbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Straight-Arm Cable Pulldown',
      'Weight Training',
      'A lat-focused cable exercise with arms staying mostly straight.',
      'Stand facing a high cable with a straight bar. Keep a slight elbow bend and pull the bar down toward your thighs, then return with control. Brace your core so your lower back does not arch.',
      'Lats',
      'Cable machine',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Single-Arm Lat Pulldown',
      'Weight Training',
      'A unilateral pulldown that helps even out left-to-right strength.',
      'Sit at a pulldown station holding one handle. Pull the handle to your upper chest, pause, then return slowly. Keep your torso tall and finish all reps before switching sides.',
      'Lats, biceps, upper back',
      'Cable machine',
      'cable',
      '10-12 each side'::text,
      NULL::integer
    ),
    (
      'T-Bar Row',
      'Weight Training',
      'A bent-over row using a landmine or T-bar station.',
      'Hinge forward with a flat back and grip the handles. Row the weight toward your chest, then lower. Keep your neck in line with your spine.',
      'Lats, upper back, biceps',
      'T-bar or landmine',
      'barbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Pendlay Row',
      'Weight Training',
      'A strict barbell row that starts from the floor each rep.',
      'Hinge until your torso is close to parallel and the bar is on the floor. Row explosively to your lower chest, then lower the bar fully to the floor before the next rep. Keep your back flat.',
      'Lats, upper back, spinal erectors',
      'Barbell',
      'barbell',
      '6-10'::text,
      NULL::integer
    ),
    (
      'Barbell Seal Row',
      'Weight Training',
      'A chest-supported barbell row that removes lower-back strain.',
      'Lie face down on a raised bench with a barbell below you. Row the bar to the bench, pause, then lower until the arms are straight. Avoid yanking with your neck.',
      'Lats, upper back, rear delts',
      'Barbell, raised bench',
      'barbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Machine Row',
      'Weight Training',
      'A supported rowing machine that makes it easy to focus on the back.',
      'Sit with your chest against the pad and grab the handles. Pull them toward your torso, squeeze your shoulder blades, then return. Keep your shoulders from rolling forward.',
      'Lats, upper back, biceps',
      'Row machine',
      'machine',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Cable Face Pull',
      'Weight Training',
      'A rear-delt and upper-back cable exercise using a rope.',
      'Set a cable at face height with a rope. Pull the rope toward your face while flaring your elbows out, then return. Think about pulling your hands apart at the end.',
      'Rear delts, upper back',
      'Cable machine, rope',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Dumbbell Rear Delt Row',
      'Weight Training',
      'A wide, elbow-out row that targets the rear shoulders.',
      'Hinge forward holding dumbbells. Row them out to the sides with elbows high, then lower. Keep the movement controlled and avoid swinging.',
      'Rear delts, upper back',
      'Dumbbells',
      'dumbbell',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Arnold Press',
      'Weight Training',
      'A dumbbell shoulder press that rotates from a facing-you start to palms-forward overhead.',
      'Start with dumbbells in front of your shoulders, palms facing you. Press overhead while rotating your palms forward, then reverse the path. Keep your ribs down.',
      'Shoulders, triceps',
      'Dumbbells',
      'dumbbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Dumbbell Front Raise',
      'Weight Training',
      'An isolation raise for the front of the shoulders.',
      'Hold dumbbells at your thighs. Raise them in front of you to shoulder height with a slight elbow bend, then lower slowly. Avoid leaning back.',
      'Front delts',
      'Dumbbells',
      'dumbbell',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Cable Lateral Raise',
      'Weight Training',
      'A side-delt raise using a low cable for constant tension.',
      'Stand sideways to a low cable and raise the handle out to shoulder height. Lower under control. Keep a small bend in the elbow and do not shrug.',
      'Side delts',
      'Cable machine',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Rear Delt Fly',
      'Weight Training',
      'A reverse fly that targets the rear shoulders.',
      'Hinge forward with dumbbells hanging below your shoulders. Raise your arms out to the sides until they are roughly in line with your torso, then lower. Lead with your elbows.',
      'Rear delts, upper back',
      'Dumbbells',
      'dumbbell',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Reverse Pec Deck',
      'Weight Training',
      'A machine reverse fly for the rear delts.',
      'Sit facing the pec deck pads and grab the handles with arms nearly straight. Pull them back until they are in line with your shoulders, then return slowly.',
      'Rear delts, upper back',
      'Pec deck machine',
      'machine',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Barbell Push Press',
      'Weight Training',
      'An overhead press that uses a small dip of the legs to help drive the bar up.',
      'Hold the bar at your shoulders. Dip your knees slightly, then drive up and press the bar overhead. Lower it back to the shoulders with control. Keep the bar close to your face.',
      'Shoulders, triceps, legs',
      'Barbell',
      'barbell',
      '5-8'::text,
      NULL::integer
    ),
    (
      'Landmine Press',
      'Weight Training',
      'A single-arm press using a barbell anchored in a landmine.',
      'Hold the end of the bar at your shoulder and stagger your stance. Press it up and slightly forward, then lower. Brace your core so you do not twist excessively.',
      'Shoulders, chest, core',
      'Barbell, landmine',
      'barbell',
      '8-12 each side'::text,
      NULL::integer
    ),
    (
      'Dumbbell Upright Row',
      'Weight Training',
      'A pulling exercise that raises dumbbells along the front of the body.',
      'Hold dumbbells in front of your thighs. Pull them up toward your chest, leading with your elbows. Lower slowly. Use a comfortable range if your shoulders feel cramped.',
      'Shoulders, upper traps',
      'Dumbbells',
      'dumbbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Cable Front Raise',
      'Weight Training',
      'A front-delt raise using a low cable.',
      'Face away from a low cable or stand beside it and raise the handle to shoulder height. Lower with control. Keep your elbow slightly bent.',
      'Front delts',
      'Cable machine',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Dumbbell Shrug',
      'Weight Training',
      'A simple trap exercise lifting the shoulders toward the ears.',
      'Hold dumbbells at your sides. Lift your shoulders straight up, pause, then lower. Avoid rolling the shoulders in a circle.',
      'Upper traps',
      'Dumbbells',
      'dumbbell',
      '12-15'::text,
      NULL::integer
    ),
    (
      'EZ-Bar Curl',
      'Weight Training',
      'A biceps curl using an EZ-bar, which is often more comfortable on the wrists.',
      'Hold the EZ-bar with a shoulder-width grip. Curl it toward your shoulders, then lower under control. Keep your elbows close to your sides.',
      'Biceps',
      'EZ-bar',
      'barbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Preacher Curl',
      'Weight Training',
      'A biceps curl with the upper arms supported on a preacher pad.',
      'Sit at a preacher bench and rest your arms on the pad. Curl the bar or dumbbell up, then lower until the arms are almost straight. Do not bounce at the bottom.',
      'Biceps',
      'Preacher bench, EZ-bar or dumbbell',
      'barbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Concentration Curl',
      'Weight Training',
      'A seated single-arm curl that isolates the biceps.',
      'Sit and rest your elbow against the inside of your thigh. Curl the dumbbell toward your shoulder, then lower slowly. Keep the upper arm still.',
      'Biceps',
      'Dumbbell',
      'dumbbell',
      '10-12 each side'::text,
      NULL::integer
    ),
    (
      'Incline Dumbbell Curl',
      'Weight Training',
      'A biceps curl on an incline bench that stretches the long head of the biceps.',
      'Sit back on an incline bench with arms hanging. Curl the dumbbells up without swinging, then lower fully. Keep your head against the bench.',
      'Biceps',
      'Dumbbells, incline bench',
      'dumbbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Cable Biceps Curl',
      'Weight Training',
      'A standing curl using a low cable for constant tension.',
      'Hold a straight bar or EZ attachment on a low cable. Curl toward your shoulders, then lower slowly. Keep your elbows pinned at your sides.',
      'Biceps',
      'Cable machine',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Reverse Curl',
      'Weight Training',
      'A curl with an overhand grip that trains the forearms and brachialis.',
      'Hold a bar with palms facing down. Curl it up, then lower with control. Use a lighter weight than a standard curl and keep the wrists fairly straight.',
      'Forearms, brachialis, biceps',
      'EZ-bar or barbell',
      'barbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Zottman Curl',
      'Weight Training',
      'A curl that rotates from palms-up on the way up to palms-down on the way down.',
      'Curl dumbbells with palms up. At the top, turn your palms down and lower slowly. Reset the grip at the bottom. Move through a full, controlled range.',
      'Biceps, forearms',
      'Dumbbells',
      'dumbbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Wrist Curl',
      'Weight Training',
      'A forearm exercise curling the wrists with palms up.',
      'Sit with forearms on your thighs or a bench, wrists hanging off the edge, palms up. Curl the weight up, then lower slowly. Use a light load.',
      'Forearms',
      'Dumbbell or barbell',
      'dumbbell',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Reverse Wrist Curl',
      'Weight Training',
      'A forearm exercise curling the wrists with palms down.',
      'Sit with forearms supported and palms down. Extend your wrists to lift the weight, then lower. Keep the movement small and controlled.',
      'Forearms',
      'Dumbbell or barbell',
      'dumbbell',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Overhead Dumbbell Triceps Extension',
      'Weight Training',
      'A triceps exercise lowering a dumbbell behind the head.',
      'Hold one dumbbell overhead with both hands. Bend your elbows to lower it behind your head, then extend back up. Keep your elbows pointing forward as much as comfortable.',
      'Triceps',
      'Dumbbell',
      'dumbbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Cable Overhead Triceps Extension',
      'Weight Training',
      'An overhead triceps extension using a cable and rope or bar.',
      'Face away from a high or mid cable and hold the rope overhead. Extend your arms, then return by bending the elbows. Keep your ribs down.',
      'Triceps',
      'Cable machine',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Dumbbell Triceps Kickback',
      'Weight Training',
      'A bent-over isolation exercise for the triceps.',
      'Hinge forward with one knee and hand on a bench. Keep your upper arm in line with your torso and extend the dumbbell back until the arm is straight. Lower only at the elbow.',
      'Triceps',
      'Dumbbell, bench',
      'dumbbell',
      '12-15 each side'::text,
      NULL::integer
    ),
    (
      'Tate Press',
      'Weight Training',
      'A lying dumbbell triceps press with elbows flared out.',
      'Lie on a bench holding dumbbells over your chest, palms facing your feet. Lower the inner plates toward your chest by bending the elbows out, then press back up.',
      'Triceps',
      'Dumbbells, bench',
      'dumbbell',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Bench Dips',
      'Calisthenics',
      'A triceps dip using a bench behind you.',
      'Place your hands on a bench behind you with feet on the floor. Lower your body by bending the elbows, then press back up. Keep your shoulders down and stop above a painful range.',
      'Triceps, chest, shoulders',
      'Bench',
      'bodyweight',
      '10-15'::text,
      NULL::integer
    ),
    (
      'Single-Arm Cable Triceps Extension',
      'Weight Training',
      'A one-arm cable pushdown or overhead extension for the triceps.',
      'Stand at a cable station with a single handle. Extend your elbow until the arm is straight, then return slowly. Keep your upper arm still.',
      'Triceps',
      'Cable machine',
      'cable',
      '12-15 each side'::text,
      NULL::integer
    ),
    (
      'Front-Foot Elevated Split Squat',
      'Calisthenics',
      'A split squat with the front foot raised to increase range of motion.',
      'Place your front foot on a small plate or step and your rear foot behind you. Lower the back knee toward the floor, then stand. Keep most of the weight in the front foot.',
      'Quads, glutes',
      'Step or weight plates',
      'bodyweight',
      '8-12 each leg'::text,
      NULL::integer
    ),
    (
      'Reverse Step-Up',
      'Calisthenics',
      'A step-up variation starting from the top of a box and stepping down backward.',
      'Stand on a box. Step one foot back and down to the floor, then drive through the standing leg to return. Keep the working hip and knee stable.',
      'Quads, glutes',
      'Box or bench',
      'bodyweight',
      '10 each leg'::text,
      NULL::integer
    ),
    (
      'Lateral Lunge',
      'Calisthenics',
      'A side lunge that trains the inner and outer thighs along with the glutes.',
      'Step out to the side and sit your hips back over the working foot. Keep the other leg relatively straight. Push back to standing. Point the working knee in the same direction as the toes.',
      'Quads, glutes, adductors',
      'None',
      'bodyweight',
      '8-10 each side'::text,
      NULL::integer
    ),
    (
      'Curtsy Lunge',
      'Calisthenics',
      'A lunge that steps the rear leg behind and across the body.',
      'Stand tall, then step one foot behind and outside the other as if curtsying. Lower, then return to standing. Keep your torso upright and the front knee tracking over the foot.',
      'Glutes, quads',
      'None',
      'bodyweight',
      '8-10 each side'::text,
      NULL::integer
    ),
    (
      'Sumo Squat',
      'Calisthenics',
      'A wide-stance squat that emphasizes the inner thighs and glutes.',
      'Stand with a wide stance and toes turned out. Sit your hips down and back, then stand. Keep your knees tracking in the same direction as your toes.',
      'Quads, glutes, adductors',
      'None',
      'bodyweight',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Hack Squat',
      'Weight Training',
      'A machine squat with your back supported on a pad.',
      'Place your feet on the platform and your back on the pad. Lower until your thighs are at least parallel, then press back up. Keep your hips and back against the pad.',
      'Quads, glutes',
      'Hack squat machine',
      'machine',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Smith Machine Squat',
      'Weight Training',
      'A squat on a Smith machine, which guides the bar path.',
      'Set your feet so you can sit back comfortably. Unrack, squat to a depth you can control, then stand. Keep your feet from sliding and avoid crashing into the safeties.',
      'Quads, glutes, hamstrings',
      'Smith machine',
      'machine',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Belt Squat',
      'Weight Training',
      'A squat where the load hangs from a belt, reducing spinal loading.',
      'Stand on the platform with the belt secured. Sit your hips down and back, then stand. Keep your chest up and use a depth you can control.',
      'Quads, glutes',
      'Belt squat machine',
      'machine',
      '10-12'::text,
      NULL::integer
    ),
    (
      'Kettlebell Swing',
      'Weight Training',
      'A hip-hinge power exercise using a kettlebell.',
      'Hinge at the hips, hike the kettlebell back, then snap your hips forward to swing it to about chest height. Let it float, then hinge again. Keep your back flat and arms relaxed.',
      'Glutes, hamstrings, core',
      'Kettlebell',
      'other',
      '12-20'::text,
      NULL::integer
    ),
    (
      'Kettlebell Deadlift',
      'Weight Training',
      'A kettlebell hip hinge that teaches deadlift mechanics with a simpler setup.',
      'Stand over a kettlebell with feet about hip-width apart. Hinge, grip the handle, and stand up by driving through your feet. Lower it back to the floor with a flat back.',
      'Glutes, hamstrings, back',
      'Kettlebell',
      'other',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Barbell Lunge',
      'Weight Training',
      'A forward or walking lunge with a barbell on the upper back.',
      'Unrack the bar and step forward into a lunge. Lower the back knee, then push back to standing or into the next step. Keep the front knee tracking over the foot.',
      'Quads, glutes, hamstrings',
      'Barbell',
      'barbell',
      '8-10 each leg'::text,
      NULL::integer
    ),
    (
      'Barbell Split Squat',
      'Weight Training',
      'A stationary split squat with a barbell on the back.',
      'Set a split stance with the bar on your upper back. Lower the back knee toward the floor, then stand. Keep most of your weight in the front foot.',
      'Quads, glutes',
      'Barbell',
      'barbell',
      '8-10 each leg'::text,
      NULL::integer
    ),
    (
      'Dumbbell Walking Lunge',
      'Weight Training',
      'A walking lunge holding dumbbells at your sides.',
      'Hold dumbbells and step forward into a lunge. Push through the front foot into the next step. Keep your torso upright and take controlled steps.',
      'Quads, glutes, hamstrings',
      'Dumbbells',
      'dumbbell',
      '10 each leg'::text,
      NULL::integer
    ),
    (
      'Dumbbell Step-Up',
      'Weight Training',
      'A step-up holding dumbbells for extra load.',
      'Hold dumbbells and place one foot fully on a box. Drive through that foot to stand, then step down under control. Avoid pushing off the back foot too much.',
      'Quads, glutes',
      'Dumbbells, box or bench',
      'dumbbell',
      '10 each leg'::text,
      NULL::integer
    ),
    (
      'Good Morning',
      'Weight Training',
      'A hip-hinge with a barbell on the upper back, emphasizing the hamstrings.',
      'Set the bar on your upper back and unlock your knees. Push your hips back until your torso is close to parallel, then stand. Keep your back flat and use a light load until the pattern feels solid.',
      'Hamstrings, glutes, lower back',
      'Barbell',
      'barbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Stiff-Leg Deadlift',
      'Weight Training',
      'A deadlift variation with less knee bend than a conventional pull.',
      'Hold a barbell at your thighs with a slight knee bend. Hinge at the hips and lower the bar along your legs, then stand. Stop if your back rounds.',
      'Hamstrings, glutes, lower back',
      'Barbell',
      'barbell',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Single-Leg Romanian Deadlift',
      'Weight Training',
      'A single-leg hip hinge that challenges balance and the posterior chain.',
      'Stand on one foot holding a dumbbell. Hinge forward as the other leg extends behind you, then return to standing. Keep your hips square to the floor.',
      'Hamstrings, glutes, core',
      'Dumbbell',
      'dumbbell',
      '8-10 each leg'::text,
      NULL::integer
    ),
    (
      'Sumo Deadlift',
      'Weight Training',
      'A wide-stance deadlift that often allows a more upright torso.',
      'Stand wide with toes turned out and grip the bar inside your knees. Brace, then stand by driving the floor away. Keep the bar close and your back flat.',
      'Glutes, hamstrings, quads, back',
      'Barbell',
      'barbell',
      '5-8'::text,
      NULL::integer
    ),
    (
      'Trap Bar Deadlift',
      'Weight Training',
      'A deadlift using a hex or trap bar, which places the load at your sides.',
      'Stand inside the trap bar, grip the handles, and brace. Stand up by driving through your feet, then lower the bar with control. This is often more knee-friendly than a straight bar.',
      'Quads, glutes, hamstrings, back',
      'Trap bar',
      'barbell',
      '5-8'::text,
      NULL::integer
    ),
    (
      'Cable Pull-Through',
      'Weight Training',
      'A cable hip hinge that targets the glutes and hamstrings.',
      'Face away from a low cable, straddle the rope, and walk forward. Hinge until you feel a stretch, then snap your hips forward. Keep your arms relaxed.',
      'Glutes, hamstrings',
      'Cable machine, rope',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Glute Kickback',
      'Weight Training',
      'A cable or machine movement that extends one hip at a time.',
      'Attach an ankle strap to a low cable. Keep a soft knee and kick the working leg back without arching your lower back. Return slowly.',
      'Glutes',
      'Cable machine or kickback machine',
      'cable',
      '12-15 each side'::text,
      NULL::integer
    ),
    (
      'Hip Abduction Machine',
      'Weight Training',
      'A machine exercise that moves the legs apart against resistance.',
      'Sit with your back against the pad and the pads on the outside of your knees. Push your knees out, pause, then return. Avoid leaning your torso excessively.',
      'Glute medius',
      'Hip abduction machine',
      'machine',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Hip Adduction Machine',
      'Weight Training',
      'A machine exercise that brings the legs together against resistance.',
      'Sit with the pads on the inside of your knees. Bring your knees together, pause, then return with control. Keep your pelvis still.',
      'Adductors',
      'Hip adduction machine',
      'machine',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Seated Calf Raise',
      'Weight Training',
      'A seated machine raise that emphasizes the soleus.',
      'Sit with the pads on your thighs and the balls of your feet on the platform. Rise onto your toes, pause, then lower your heels. Use a full comfortable range.',
      'Calves',
      'Seated calf machine',
      'machine',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Single-Leg Calf Raise',
      'Calisthenics',
      'A bodyweight calf raise performed one leg at a time.',
      'Stand on one foot on the floor or a step. Rise onto your toes, pause, then lower with control. Hold a wall for balance if needed.',
      'Calves',
      'None or step',
      'bodyweight',
      '12-15 each'::text,
      NULL::integer
    ),
    (
      'Tibialis Raise',
      'Calisthenics',
      'An exercise that lifts the toes toward the shins to train the front of the lower leg.',
      'Stand with your back against a wall and feet a short step forward, or sit with heels on the floor. Lift your toes toward your shins, then lower. Move slowly.',
      'Tibialis anterior',
      'Wall or none',
      'bodyweight',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Bicycle Crunch',
      'Core',
      'A rotating crunch that brings opposite elbow and knee together.',
      'Lie on your back with hands by your head. Alternate bringing one knee in while rotating the opposite elbow toward it. Keep the movement controlled and your lower back on the floor.',
      'Abs, obliques',
      'None',
      'bodyweight',
      '12-20 each side'::text,
      NULL::integer
    ),
    (
      'Reverse Crunch',
      'Core',
      'A crunch variation that lifts the hips instead of the shoulders.',
      'Lie on your back with knees bent. Curl your hips off the floor toward your chest, then lower slowly. Avoid swinging your legs.',
      'Abs',
      'None',
      'bodyweight',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Crunch',
      'Core',
      'A basic abdominal exercise lifting the shoulders off the floor.',
      'Lie on your back with knees bent. Curl your ribs toward your hips, lifting your shoulders slightly, then lower. Keep your neck relaxed.',
      'Abs',
      'None',
      'bodyweight',
      '12-20'::text,
      NULL::integer
    ),
    (
      'Sit-Up',
      'Core',
      'A full sit-up from the floor to a seated position.',
      'Lie on your back with knees bent. Sit all the way up, then lower with control. Anchor your feet only if you need help; stop if your lower back feels strained.',
      'Abs, hip flexors',
      'None',
      'bodyweight',
      '10-15'::text,
      NULL::integer
    ),
    (
      'V-Up',
      'Core',
      'A simultaneous lift of the arms and legs into a V shape.',
      'Lie on your back with arms overhead. Lift your legs and torso together, reaching toward your feet, then lower with control. Bend your knees if the straight-leg version is too much.',
      'Abs, hip flexors',
      'None',
      'bodyweight',
      '10-15'::text,
      NULL::integer
    ),
    (
      'Russian Twist',
      'Core',
      'A seated rotation that trains the obliques.',
      'Sit with knees bent and lean back slightly. Rotate your torso from side to side. Keep your chest up and move from the trunk, not just the arms.',
      'Obliques, abs',
      'None or light weight',
      'bodyweight',
      '12-16 each side'::text,
      NULL::integer
    ),
    (
      'Leg Raise',
      'Core',
      'A lying exercise that lifts the legs while keeping the lower back stable.',
      'Lie on your back with legs straight. Press your lower back into the floor and lift your legs, then lower slowly. Bend your knees if your back arches.',
      'Abs, hip flexors',
      'None',
      'bodyweight',
      '10-15'::text,
      NULL::integer
    ),
    (
      'Hanging Knee Raise',
      'Core',
      'A hanging core exercise lifting the knees toward the chest.',
      'Hang from a bar. Raise your knees toward your chest without swinging, then lower. Keep your shoulders active so you are not just hanging passively.',
      'Abs, hip flexors',
      'Pull-up bar',
      'bodyweight',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Hanging Leg Raise',
      'Core',
      'A hanging core exercise lifting straight legs.',
      'Hang from a bar with legs straight. Raise your legs toward horizontal or higher, then lower slowly. Minimize swing and stop if your shoulders feel unstable.',
      'Abs, hip flexors',
      'Pull-up bar',
      'bodyweight',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Flutter Kicks',
      'Core',
      'A small alternating leg flutter performed on the back.',
      'Lie on your back with legs extended and lower back pressed down. Flutter the legs a short distance up and down. Keep the movement small.',
      'Abs, hip flexors',
      'None',
      'bodyweight',
      NULL::text,
      30::integer
    ),
    (
      'Heel Taps',
      'Core',
      'A side-to-side reach toward the heels while lying on the back.',
      'Lie on your back with knees bent. Reach one hand toward the same-side heel, then the other. Keep your shoulders slightly lifted and your neck relaxed.',
      'Obliques, abs',
      'None',
      'bodyweight',
      '16-20'::text,
      NULL::integer
    ),
    (
      'Bird Dog',
      'Core',
      'A quadruped stability exercise extending opposite arm and leg.',
      'Start on hands and knees. Extend one arm and the opposite leg, pause, then return. Keep your hips level and your back from sagging.',
      'Core, glutes, upper back',
      'None',
      'bodyweight',
      '8-10 each side'::text,
      NULL::integer
    ),
    (
      'Bear Crawl',
      'Core',
      'A crawl on hands and toes with knees hovering off the floor.',
      'Start on all fours, lift your knees an inch, and crawl forward or in place. Keep your hips low and your core braced. Move slowly.',
      'Core, shoulders',
      'None',
      'bodyweight',
      NULL::text,
      30::integer
    ),
    (
      'Plank Shoulder Tap',
      'Core',
      'A plank with alternating shoulder taps.',
      'Hold a high plank and tap one hand to the opposite shoulder. Keep your hips as still as possible. Alternate sides.',
      'Core, shoulders',
      'None',
      'bodyweight',
      '8-12 each side'::text,
      NULL::integer
    ),
    (
      'Plank Hip Dips',
      'Core',
      'A forearm plank with controlled hip rotation side to side.',
      'Hold a forearm plank and slowly rotate one hip toward the floor, then the other. Keep the movement small and avoid collapsing through the shoulders.',
      'Obliques, core',
      'None',
      'bodyweight',
      '10-12 each side'::text,
      NULL::integer
    ),
    (
      'Pallof Press',
      'Core',
      'An anti-rotation press using a cable or band.',
      'Stand sideways to a cable at chest height. Press the handle straight out, resist the twist, then bring it back. Keep your hips and ribs square.',
      'Core, obliques',
      'Cable machine or band',
      'cable',
      '8-12 each side'::text,
      NULL::integer
    ),
    (
      'Cable Crunch',
      'Core',
      'A kneeling crunch using a high cable.',
      'Kneel facing a high cable with a rope behind your head. Crunch your ribs toward your hips, then return. Round through the abs rather than yanking with your arms.',
      'Abs',
      'Cable machine',
      'cable',
      '12-15'::text,
      NULL::integer
    ),
    (
      'Ab Wheel Rollout',
      'Core',
      'A rollout from the knees or standing using an ab wheel.',
      'Kneel and hold the wheel under your shoulders. Roll forward as far as you can while keeping a braced core, then roll back. Stop before your lower back sags.',
      'Abs, lats, shoulders',
      'Ab wheel',
      'other',
      '8-12'::text,
      NULL::integer
    ),
    (
      'Suitcase Carry',
      'Core',
      'A walk holding a weight on one side to challenge lateral core stability.',
      'Hold a dumbbell or kettlebell in one hand and walk tall. Do not lean away from or toward the weight. Switch sides.',
      'Obliques, core, grip',
      'Dumbbell or kettlebell',
      'other',
      NULL::text,
      30::integer
    ),
    (
      'Farmer''s Carry',
      'Core',
      'A loaded walk holding weights in both hands.',
      'Pick up a dumbbell or kettlebell in each hand and walk with a tall posture. Keep the weights from swinging and take even steps.',
      'Grip, traps, core',
      'Dumbbells or kettlebells',
      'other',
      NULL::text,
      30::integer
    ),
    (
      'Turkish Get-Up',
      'Core',
      'A slow, full-body get-up from lying to standing while holding a weight overhead.',
      'Lie on your back holding a kettlebell straight up. Move through the get-up positions to standing, then reverse them. Keep your eyes on the weight and use a light load until the steps feel smooth.',
      'Core, shoulders, full body',
      'Kettlebell',
      'other',
      '3-5 each side'::text,
      NULL::integer
    ),
    (
      'Kettlebell Windmill',
      'Core',
      'A side-bend hinge with a kettlebell held overhead.',
      'Press a kettlebell overhead. Hinge and slide the free hand down the inside of the same-side leg while keeping the top arm vertical. Stand back up. Move slowly.',
      'Obliques, shoulders, hamstrings',
      'Kettlebell',
      'other',
      '6-8 each side'::text,
      NULL::integer
    ),
    (
      'Back Extension',
      'Core',
      'A hip-hinge extension on a Roman chair or floor for the posterior chain.',
      'Set up on a back-extension bench with the pad at your hips. Lower your torso, then raise until your body is in a straight line. Avoid hyperextending the lower back.',
      'Lower back, glutes, hamstrings',
      'Back extension bench',
      'other',
      '10-15'::text,
      NULL::integer
    ),
    (
      'Copenhagen Plank',
      'Core',
      'A side plank with the top leg supported on a bench to train the adductors and core.',
      'Place your top foot or shin on a bench and hold a side plank. Keep your hips high and your body in a line. Start with a short hold.',
      'Adductors, obliques, core',
      'Bench',
      'bodyweight',
      NULL::text,
      20::integer
    ),
    (
      'L-Sit',
      'Core',
      'An isometric hold with the legs straight in front of you while supporting on parallettes or the floor.',
      'Support yourself on parallettes or the floor and lift your legs until they are straight in front of you. Keep your chest up and shoulders down. Bend your knees if a full L-sit is not yet available.',
      'Abs, hip flexors, triceps',
      'Parallettes or floor',
      'bodyweight',
      NULL::text,
      15::integer
    )
) as n(
  name,
  category,
  description,
  form_instructions,
  primary_muscles,
  equipment,
  exercise_type,
  default_repetitions,
  default_duration_seconds
)
where not exists (
  select 1
  from public.exercise_library e
  where e.is_system_exercise = true
    and lower(e.name) = lower(n.name)
);
