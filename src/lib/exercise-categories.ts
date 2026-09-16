import type { ExerciseLibraryEntry } from "@/lib/types";

export const FILTER_CATEGORIES = [
  "All",
  "Calisthenics",
  "Weight Training",
  "Core",
  "Cardio",
  "Other",
] as const;

export const EXERCISE_CATEGORIES = [
  "Calisthenics",
  "Weight Training",
  "Core",
  "Cardio",
  "Other",
] as const;

export function matchesCategory(
  exercise: ExerciseLibraryEntry,
  category: string,
): boolean {
  if (category === "All") return true;

  if (exercise.category === category) return true;

  const muscles = (exercise.primary_muscles ?? "").toLowerCase();
  const name = exercise.name.toLowerCase();

  switch (category) {
    case "Core":
      return (
        muscles.includes("core") ||
        muscles.includes("oblique") ||
        muscles.includes("abdom") ||
        muscles.includes("deep stabil")
      );
    case "Cardio":
      return (
        name.includes("burpee") ||
        name.includes("mountain climber") ||
        name.includes("jump squat")
      );
    case "Upper Body":
      return (
        muscles.includes("chest") ||
        muscles.includes("shoulder") ||
        muscles.includes("tricep") ||
        muscles.includes("bicep") ||
        muscles.includes("lat") ||
        muscles.includes("upper back")
      );
    case "Lower Body":
      return (
        muscles.includes("quad") ||
        muscles.includes("glute") ||
        muscles.includes("hamstring") ||
        muscles.includes("calf") ||
        muscles.includes("calves")
      );
    case "Full Body":
      return muscles.includes("full body");
    default:
      return false;
  }
}
