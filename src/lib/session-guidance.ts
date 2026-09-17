import type { createClient } from "@/lib/supabase/server";
import type { ExerciseLibraryEntry, WorkoutSessionExercise } from "@/lib/types";
import { normalizeSessionExercise } from "@/lib/workout-tracking";

type ServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

type TemplateLibraryRow = {
  id: string;
  exercise_library_id: string | null;
};

type LibraryGuidance = Pick<
  ExerciseLibraryEntry,
  "id" | "description" | "form_instructions" | "primary_muscles" | "equipment" | "video_url"
>;

export async function attachLibraryGuidance(
  supabase: ServerClient,
  exercises: WorkoutSessionExercise[],
): Promise<WorkoutSessionExercise[]> {
  const normalized = exercises.map(normalizeSessionExercise);
  const needingGuidance = normalized.filter((exercise) => !exercise.form_instructions);
  if (needingGuidance.length === 0) {
    return normalized;
  }

  const templateIds = Array.from(
    new Set(
      needingGuidance
        .map((exercise) => exercise.template_exercise_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const sessionLibraryIds = Array.from(
    new Set(
      needingGuidance
        .map((exercise) => exercise.exercise_library_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const templateToLibrary = new Map<string, string>();
  if (templateIds.length > 0) {
    const { data } = await supabase
      .from("workout_template_exercises")
      .select("id, exercise_library_id")
      .in("id", templateIds);
    for (const row of (data as TemplateLibraryRow[] | null) ?? []) {
      if (row.exercise_library_id) {
        templateToLibrary.set(row.id, row.exercise_library_id);
      }
    }
  }

  const libraryIds = Array.from(
    new Set([
      ...sessionLibraryIds,
      ...Array.from(templateToLibrary.values()),
    ]),
  );

  if (libraryIds.length === 0) {
    return normalized;
  }

  const { data } = await supabase
    .from("exercise_library")
    .select("id, description, form_instructions, primary_muscles, equipment, video_url")
    .in("id", libraryIds);

  const libraryById = new Map(
    ((data as LibraryGuidance[] | null) ?? []).map((entry) => [entry.id, entry]),
  );

  return normalized.map((exercise) => {
    if (exercise.form_instructions) return exercise;
    const libraryId =
      exercise.exercise_library_id ??
      (exercise.template_exercise_id
        ? templateToLibrary.get(exercise.template_exercise_id)
        : undefined);
    if (!libraryId) return exercise;
    const library = libraryById.get(libraryId);
    if (!library) return exercise;
    return {
      ...exercise,
      exercise_library_id: exercise.exercise_library_id ?? library.id,
      description: exercise.description ?? library.description,
      form_instructions: library.form_instructions,
      primary_muscles: exercise.primary_muscles ?? library.primary_muscles,
      equipment: exercise.equipment ?? library.equipment,
      video_url: exercise.video_url || library.video_url,
    };
  });
}
