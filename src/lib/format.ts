import type { WorkoutSessionExercise, WorkoutTemplateExercise } from "@/lib/types";

export function getUserFacingError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const rawMessage =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (rawMessage.includes("Supabase is not configured")) {
    return "Supabase is not configured. Add your project URL and anon key to .env.local.";
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = rawMessage;
    const normalized = message.toLowerCase();

    if (normalized.includes("invalid login")) {
      return "Email or password is incorrect.";
    }
    if (normalized.includes("user already registered")) {
      return "An account with this email already exists.";
    }
    if (normalized.includes("email not confirmed")) {
      return "Please confirm your email before logging in.";
    }
    if (normalized.includes("password")) {
      return "Please check your password and try again.";
    }
    if (normalized.includes("not authenticated") || normalized.includes("jwt")) {
      return "Your session expired. Please log in again.";
    }
    if (normalized.includes("template not found")) {
      return "That workout template could not be found.";
    }
    if (normalized.includes("session not found")) {
      return "That workout could not be found.";
    }
    if (normalized.includes("failed to fetch") || normalized.includes("network")) {
      return "Could not reach the server. Check your connection and try again.";
    }
  }

  console.error(error);
  return fallback;
}

export function formatExercisePrescription(
  exercise: Pick<
    WorkoutTemplateExercise | WorkoutSessionExercise,
    "sets" | "repetitions" | "duration_seconds" | "weight" | "weight_unit" | "rest_seconds"
  >,
): string {
  const parts: string[] = [];

  if (exercise.sets && exercise.sets > 1 && exercise.repetitions) {
    parts.push(`${exercise.sets} sets × ${exercise.repetitions}`);
  } else if (exercise.sets && exercise.sets > 1) {
    parts.push(`${exercise.sets} sets`);
  } else if (exercise.repetitions) {
    parts.push(
      /each|sec|min|s\b/i.test(exercise.repetitions)
        ? exercise.repetitions
        : `${exercise.repetitions} reps`,
    );
  }

  if (exercise.duration_seconds) {
    parts.push(formatSeconds(exercise.duration_seconds));
  }

  if (exercise.weight != null) {
    parts.push(`${exercise.weight} ${exercise.weight_unit || "lb"}`);
  }

  if (exercise.rest_seconds) {
    parts.push(`${exercise.rest_seconds}s rest`);
  }

  return parts.join(" · ");
}

export function formatSeconds(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} min`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }
  return `${seconds} sec`;
}

export function workoutTypeLabel(type: string): string {
  if (type === "circuit") return "Circuit";
  if (type === "run") return "Run";
  return "Standard";
}

export function formatDistance(distance: number | null | undefined, unit: string = "mi"): string | null {
  if (distance == null || Number.isNaN(distance)) return null;
  return `${distance.toFixed(2)} ${unit}`;
}

export function statusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  if (status === "abandoned") return "Abandoned";
  return status;
}
