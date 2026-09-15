import { notFound } from "next/navigation";
import { ConfigError } from "@/components/config-error";
import { ButtonLink } from "@/components/ui/button-link";
import { formatDisplayDate, formatDuration } from "@/lib/dates";
import { formatExercisePrescription, statusLabel, workoutTypeLabel } from "@/lib/format";
import { requireUser } from "@/lib/supabase/require-user";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionRound,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Workout details",
};

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { supabase, configured } = await requireUser();
  if (!configured || !supabase) {
    return <ConfigError />;
  }

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    notFound();
  }

  const typedSession = session as WorkoutSession;

  const [{ data: exercises }, { data: rounds }] = await Promise.all([
    supabase
      .from("workout_session_exercises")
      .select("*")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true })
      .order("exercise_order", { ascending: true })
      .order("set_number", { ascending: true }),
    supabase
      .from("workout_session_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true }),
  ]);

  const items = (exercises as WorkoutSessionExercise[] | null) ?? [];
  const roundRows = (rounds as WorkoutSessionRound[] | null) ?? [];
  const completedCount = items.filter((exercise) => exercise.completed).length;
  const uniqueRounds = Array.from(new Set(items.map((exercise) => exercise.round_number))).sort(
    (a, b) => a - b,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted">{formatDisplayDate(typedSession.workout_date)}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{typedSession.template_name}</h1>
        <p className="text-muted">
          {statusLabel(typedSession.status)} · {workoutTypeLabel(typedSession.workout_type)} ·{" "}
          {typedSession.rounds} {typedSession.rounds === 1 ? "round" : "rounds"}
          {typedSession.duration_seconds
            ? ` · ${formatDuration(typedSession.duration_seconds)}`
            : ""}
        </p>
      </header>

      <p className="rounded-3xl border border-border bg-surface px-4 py-3 text-sm text-muted">
        {completedCount} of {items.length} exercises completed
      </p>

      {uniqueRounds.map((roundNumber) => {
        const roundTime = roundRows.find((round) => round.round_number === roundNumber);
        const roundExercises = items.filter((exercise) => exercise.round_number === roundNumber);
        return (
          <section key={roundNumber} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {uniqueRounds.length > 1 ? `Round ${roundNumber}` : "Exercises"}
              </h2>
              {roundTime?.duration_seconds ? (
                <span className="text-sm text-muted">
                  {formatDuration(roundTime.duration_seconds)}
                </span>
              ) : null}
            </div>
            {roundExercises.map((exercise) => (
              <article
                key={exercise.id}
                className={cn(
                  "rounded-3xl border p-4",
                  exercise.completed
                    ? "border-accent/30 bg-accent-soft/40"
                    : "border-border bg-surface",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{exercise.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {exercise.sets && exercise.sets > 1 ? `Set ${exercise.set_number} · ` : ""}
                      {formatExercisePrescription(exercise) || "No target specified"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-accent">
                    {exercise.completed ? "Done" : "Skipped"}
                  </span>
                </div>
              </article>
            ))}
          </section>
        );
      })}

      <ButtonLink href="/history" variant="secondary" className="w-full">
        Back to History
      </ButtonLink>
    </div>
  );
}
