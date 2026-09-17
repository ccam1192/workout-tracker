import { formatSeconds } from "@/lib/format";
import type { WorkoutSessionExercise } from "@/lib/types";
import { parseOptionalInt, parseOptionalNumber } from "@/lib/utils";

export type SetDraft = {
  reps: string;
  weight: string;
  duration: string;
  unit: string;
  notes: string;
};

export function parsePlannedReps(repetitions: string | null | undefined): number | null {
  if (!repetitions) return null;
  const match = repetitions.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function defaultActualReps(exercise: WorkoutSessionExercise): number | null {
  return exercise.repetitions_completed ?? parsePlannedReps(exercise.repetitions);
}

export function defaultActualWeight(exercise: WorkoutSessionExercise): number | null {
  return exercise.weight_used ?? exercise.weight;
}

export function defaultActualDuration(exercise: WorkoutSessionExercise): number | null {
  return exercise.duration_seconds_completed ?? exercise.duration_seconds;
}

export function numberToDraft(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

export function createSetDraft(exercise: WorkoutSessionExercise): SetDraft {
  return {
    reps: numberToDraft(defaultActualReps(exercise)),
    weight: numberToDraft(defaultActualWeight(exercise)),
    duration: numberToDraft(defaultActualDuration(exercise)),
    unit: exercise.weight_unit || "lb",
    notes: exercise.notes ?? "",
  };
}

export function formatRepsLabel(repetitions: string): string {
  return /each|sec|min|s\b|reps?/i.test(repetitions)
    ? repetitions
    : `${repetitions} reps`;
}

export function formatPlannedTarget(exercise: WorkoutSessionExercise): string {
  const parts: string[] = [];

  if (exercise.repetitions) {
    parts.push(formatRepsLabel(exercise.repetitions));
  }

  if (exercise.duration_seconds) {
    parts.push(formatSeconds(exercise.duration_seconds));
  }

  let label = parts.join(" · ");

  if (exercise.weight != null) {
    const weight = `${exercise.weight} ${exercise.weight_unit || "lb"}`;
    label = label ? `${label} @ ${weight}` : weight;
  }

  return label;
}

export function formatActualTarget(exercise: WorkoutSessionExercise): string {
  const parts: string[] = [];
  const reps = exercise.repetitions_completed;
  const duration = exercise.duration_seconds_completed;
  const weight = exercise.weight_used;

  if (reps != null) {
    parts.push(`${reps} reps`);
  }

  if (duration != null) {
    parts.push(formatSeconds(duration));
  }

  let label = parts.join(" · ");

  if (weight != null) {
    const weightLabel = `${weight} ${exercise.weight_unit || "lb"}`;
    label = label ? `${label} @ ${weightLabel}` : weightLabel;
  }

  return label;
}

export function formatHistorySetLine(exercise: WorkoutSessionExercise): string {
  const actual = formatActualTarget({
    ...exercise,
    repetitions_completed: defaultActualReps(exercise),
    duration_seconds_completed: defaultActualDuration(exercise),
    weight_used: defaultActualWeight(exercise),
  });

  return actual || formatPlannedTarget(exercise) || "No target specified";
}

export function actualDiffersFromPlanned(exercise: WorkoutSessionExercise): boolean {
  const plannedReps = parsePlannedReps(exercise.repetitions);
  const actualReps = exercise.repetitions_completed;
  const plannedWeight = exercise.weight;
  const actualWeight = exercise.weight_used;
  const plannedDuration = exercise.duration_seconds;
  const actualDuration = exercise.duration_seconds_completed;

  if (actualReps != null && plannedReps != null && actualReps !== plannedReps) return true;
  if (actualWeight != null && plannedWeight != null && Number(actualWeight) !== Number(plannedWeight)) {
    return true;
  }
  if (actualDuration != null && plannedDuration != null && actualDuration !== plannedDuration) {
    return true;
  }

  return false;
}

export function groupSessionExercises(exercises: WorkoutSessionExercise[]) {
  const groups = new Map<string, WorkoutSessionExercise[]>();
  for (const exercise of exercises) {
    const key = `${exercise.round_number}-${exercise.exercise_order}-${exercise.name}`;
    const existing = groups.get(key) ?? [];
    existing.push(exercise);
    groups.set(key, existing);
  }
  return Array.from(groups.values()).map((group) =>
    group.sort((a, b) => a.set_number - b.set_number),
  );
}

export function hasFormGuidance(exercise: WorkoutSessionExercise): boolean {
  return Boolean(
    exercise.description ||
      exercise.form_instructions ||
      exercise.primary_muscles ||
      exercise.equipment ||
      exercise.video_url,
  );
}

export function draftToActualFields(draft: SetDraft) {
  const weight = parseOptionalNumber(draft.weight);
  return {
    repetitions_completed: parseOptionalInt(draft.reps),
    duration_seconds_completed: parseOptionalInt(draft.duration),
    weight_used: weight,
    weight_unit: weight != null ? draft.unit || "lb" : null,
    notes: draft.notes.trim() || null,
  };
}

export function normalizeSessionExercise(
  exercise: WorkoutSessionExercise,
): WorkoutSessionExercise {
  return {
    ...exercise,
    exercise_library_id: exercise.exercise_library_id ?? null,
    description: exercise.description ?? null,
    form_instructions: exercise.form_instructions ?? null,
    primary_muscles: exercise.primary_muscles ?? null,
    equipment: exercise.equipment ?? null,
  };
}

export function shouldShowReps(exercise: WorkoutSessionExercise): boolean {
  return Boolean(exercise.repetitions) || !exercise.duration_seconds;
}

export function shouldShowDuration(exercise: WorkoutSessionExercise): boolean {
  return exercise.duration_seconds != null || exercise.duration_seconds_completed != null;
}

export function shouldShowWeight(exercise: WorkoutSessionExercise): boolean {
  return exercise.weight != null || exercise.weight_used != null;
}
