import { notFound } from "next/navigation";
import { ConfigError } from "@/components/config-error";
import { DeleteSessionButton } from "@/components/delete-session-button";
import { ButtonLink } from "@/components/ui/button-link";
import { formatDisplayDate, formatDuration } from "@/lib/dates";
import { formatDistance, statusLabel, workoutTypeLabel } from "@/lib/format";
import { formatPace } from "@/lib/gps";
import { requireUser } from "@/lib/supabase/require-user";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionRound,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  actualDiffersFromPlanned,
  formatHistorySetLine,
  formatPlannedTarget,
  groupSessionExercises,
  normalizeSessionExercise,
} from "@/lib/workout-tracking";

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
  const isRun = typedSession.workout_type === "run";

  if (isRun) {
    const distanceLabel = formatDistance(typedSession.distance, typedSession.distance_unit ?? "mi");
    const activeDuration = typedSession.active_duration_seconds ?? typedSession.duration_seconds;
    const pace = typedSession.distance && activeDuration
      ? formatPace(typedSession.distance, activeDuration, (typedSession.distance_unit as "mi" | "km") ?? "mi")
      : null;
    const gpsPointCount = Array.isArray(typedSession.gps_data) ? typedSession.gps_data.length : 0;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm text-muted">{formatDisplayDate(typedSession.workout_date)}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{typedSession.template_name}</h1>
          <p className="text-muted">
            {statusLabel(typedSession.status)} · Run
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-border bg-surface p-4">
            <dt className="text-sm text-muted">Distance</dt>
            <dd className="mt-1 text-2xl font-semibold">{distanceLabel ?? "—"}</dd>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-4">
            <dt className="text-sm text-muted">Duration</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {formatDuration(activeDuration) ?? "—"}
            </dd>
          </div>
          {pace ? (
            <div className="col-span-2 rounded-3xl border border-border bg-surface p-4">
              <dt className="text-sm text-muted">Average Pace</dt>
              <dd className="mt-1 text-2xl font-semibold">{pace}</dd>
            </div>
          ) : null}
          {gpsPointCount > 0 ? (
            <div className="col-span-2 rounded-3xl border border-border bg-surface p-4">
              <dt className="text-sm text-muted">GPS Data</dt>
              <dd className="mt-1 text-sm font-medium text-muted">
                {gpsPointCount} location points recorded
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="space-y-3">
          <ButtonLink href="/history" variant="secondary" className="w-full">
            Back to History
          </ButtonLink>
          <DeleteSessionButton sessionId={typedSession.id} />
        </div>
      </div>
    );
  }

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

  const items = ((exercises as WorkoutSessionExercise[] | null) ?? []).map(normalizeSessionExercise);
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
        {completedCount} of {items.length} sets completed
      </p>

      {uniqueRounds.map((roundNumber) => {
        const roundTime = roundRows.find((round) => round.round_number === roundNumber);
        const roundExercises = items.filter((exercise) => exercise.round_number === roundNumber);
        const grouped = groupSessionExercises(roundExercises);
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
            {grouped.map((group) => {
              const first = group[0];
              if (!first) return null;
              const allComplete = group.every((exercise) => exercise.completed);
              const showSets = group.length > 1;
              const planned = first ? formatPlannedTarget(first) : "";
              const showPlanned = group.some(actualDiffersFromPlanned);
              return (
                <article
                  key={`${first.round_number}-${first.exercise_order}-${first.id}`}
                  className={cn(
                    "rounded-3xl border p-4",
                    allComplete
                      ? "border-accent/30 bg-accent-soft/40"
                      : "border-border bg-surface",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{first.name}</h3>
                      {showPlanned && planned ? (
                        <p className="mt-1 text-xs text-muted">Planned: {planned}</p>
                      ) : null}
                    </div>
                    <span className="text-sm font-semibold text-accent">
                      {allComplete ? "Done" : group.some((exercise) => exercise.completed) ? "Partial" : "Skipped"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {group.map((exercise, index) => (
                      <p key={exercise.id} className="text-sm text-muted">
                        {showSets ? `Set ${index + 1}: ` : ""}
                        {formatHistorySetLine(exercise)}
                        {!exercise.completed ? " · skipped" : ""}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}

      <div className="space-y-3">
        <ButtonLink href="/history" variant="secondary" className="w-full">
          Back to History
        </ButtonLink>
        <DeleteSessionButton sessionId={typedSession.id} />
      </div>
    </div>
  );
}
