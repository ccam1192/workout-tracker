import type { ExerciseDraft, WorkoutTemplateExercise } from "@/lib/types";
import { createDraftKey, parseOptionalInt, parseOptionalNumber, parseOptionalText } from "@/lib/utils";
import { isValidYoutubeUrl, normalizeOptionalUrl } from "@/lib/youtube";

export function exerciseToDraft(exercise: WorkoutTemplateExercise): ExerciseDraft {
  return {
    key: exercise.id,
    id: exercise.id,
    name: exercise.name,
    sets: exercise.sets?.toString() ?? "",
    repetitions: exercise.repetitions ?? "",
    duration_seconds: exercise.duration_seconds?.toString() ?? "",
    weight: exercise.weight?.toString() ?? "",
    weight_unit: exercise.weight_unit ?? "lb",
    rest_seconds: exercise.rest_seconds?.toString() ?? "",
    notes: exercise.notes ?? "",
    video_url: exercise.video_url ?? "",
  };
}

export function emptyExerciseDraft(): ExerciseDraft {
  return {
    key: createDraftKey(),
    name: "",
    sets: "",
    repetitions: "",
    duration_seconds: "",
    weight: "",
    weight_unit: "lb",
    rest_seconds: "",
    notes: "",
    video_url: "",
  };
}

export function validateExerciseDraft(exercise: ExerciseDraft, index: number): string | null {
  if (!exercise.name.trim()) {
    return `Exercise ${index + 1} needs a name.`;
  }

  const video = normalizeOptionalUrl(exercise.video_url);
  if (video && !isValidYoutubeUrl(video)) {
    return `Exercise ${index + 1} has an invalid YouTube URL.`;
  }

  return null;
}

export function draftToExerciseInsert(exercise: ExerciseDraft, templateId: string, order: number) {
  return {
    template_id: templateId,
    exercise_order: order,
    name: exercise.name.trim(),
    sets: parseOptionalInt(exercise.sets),
    repetitions: parseOptionalText(exercise.repetitions),
    duration_seconds: parseOptionalInt(exercise.duration_seconds),
    weight: parseOptionalNumber(exercise.weight),
    weight_unit: exercise.weight.trim() ? parseOptionalText(exercise.weight_unit) : null,
    rest_seconds: parseOptionalInt(exercise.rest_seconds),
    notes: parseOptionalText(exercise.notes),
    video_url: normalizeOptionalUrl(exercise.video_url),
  };
}
