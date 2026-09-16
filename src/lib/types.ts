export type WorkoutType = "standard" | "circuit" | "run";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type WeightUnit = "lb" | "kg";

export type ExerciseCategory =
  | "Calisthenics"
  | "Weight Training"
  | "Core"
  | "Cardio"
  | "Other";

export type GpsPoint = {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
};

export type ExerciseLibraryEntry = {
  id: string;
  user_id: string | null;
  name: string;
  category: string;
  description: string | null;
  form_instructions: string | null;
  primary_muscles: string | null;
  equipment: string | null;
  exercise_type: string;
  default_repetitions: string | null;
  default_duration_seconds: number | null;
  default_weight: number | null;
  default_weight_unit: string | null;
  default_rest_seconds: number | null;
  video_url: string | null;
  is_system_exercise: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  workout_type: WorkoutType;
  rounds: number | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutTemplateExercise = {
  id: string;
  template_id: string;
  exercise_order: number;
  name: string;
  sets: number | null;
  repetitions: string | null;
  duration_seconds: number | null;
  weight: number | null;
  weight_unit: string | null;
  rest_seconds: number | null;
  notes: string | null;
  video_url: string | null;
  exercise_library_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutTemplateWithExercises = WorkoutTemplate & {
  workout_template_exercises: WorkoutTemplateExercise[];
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  template_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: SessionStatus;
  workout_date: string;
  template_name: string;
  workout_type: WorkoutType;
  rounds: number;
  duration_seconds: number | null;
  distance: number | null;
  distance_unit: string | null;
  active_duration_seconds: number | null;
  gps_data: GpsPoint[] | null;
  created_at: string;
};

export type WorkoutSessionRound = {
  id: string;
  session_id: string;
  round_number: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  paused_seconds: number;
};

export type WorkoutSessionExercise = {
  id: string;
  session_id: string;
  template_exercise_id: string | null;
  exercise_order: number;
  round_number: number;
  set_number: number;
  completed: boolean;
  completed_at: string | null;
  repetitions_completed: number | null;
  duration_seconds_completed: number | null;
  weight_used: number | null;
  notes: string | null;
  name: string;
  sets: number | null;
  repetitions: string | null;
  duration_seconds: number | null;
  weight: number | null;
  weight_unit: string | null;
  rest_seconds: number | null;
  video_url: string | null;
};

export type WorkoutSessionWithDetails = WorkoutSession & {
  workout_session_exercises: WorkoutSessionExercise[];
  workout_session_rounds: WorkoutSessionRound[];
};

export type ExerciseDraft = {
  key: string;
  id?: string;
  exercise_library_id?: string;
  name: string;
  sets: string;
  repetitions: string;
  duration_seconds: string;
  weight: string;
  weight_unit: string;
  rest_seconds: string;
  notes: string;
  video_url: string;
};

export type TemplateCardData = WorkoutTemplate & {
  exerciseCount: number;
};

export type UserRole = "user" | "admin";

export type Profile = {
  id: string;
  role: UserRole;
  created_at: string;
};

export type AiKeyStatus = {
  hasKey: boolean;
  keyHint: string | null;
};

export type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiWorkoutExercise = {
  exercise_library_id: string | null;
  name: string;
  sets: number | null;
  repetitions: string | null;
  duration_seconds: number | null;
  weight: number | null;
  weight_unit: string | null;
  rest_seconds: number | null;
  notes: string | null;
};

export type AiProposedExercise = {
  name: string;
  category: string;
  description: string;
  form_instructions: string;
  primary_muscles: string;
  equipment: string;
  exercise_type: string;
  default_repetitions: string | null;
  default_duration_seconds: number | null;
};

export type AiWorkoutProposal = {
  workout: {
    name: string;
    description: string;
    workout_type: "standard" | "circuit";
    rounds: number;
    estimated_duration_minutes: number;
    exercises: AiWorkoutExercise[];
  };
  proposed_new_exercises: AiProposedExercise[];
  message: string;
};
