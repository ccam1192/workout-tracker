import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ConfigError } from "@/components/config-error";
import { ButtonLink } from "@/components/ui/button-link";
import { formatDisplayDate, formatDuration } from "@/lib/dates";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata = {
  title: "Workout complete",
};

export default async function WorkoutCompletePage({
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

  if (session.status !== "completed") {
    redirect(`/workout/${sessionId}`);
  }

  const { data: exercises } = await supabase
    .from("workout_session_exercises")
    .select("completed, round_number")
    .eq("session_id", sessionId);

  const completedExercises = (exercises ?? []).filter((exercise) => exercise.completed).length;
  const completedRounds = new Set(
    (exercises ?? [])
      .filter((exercise) => exercise.completed)
      .map((exercise) => exercise.round_number),
  ).size;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-text">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">Workout Complete!</h1>
      <p className="mt-3 text-lg text-muted">{session.template_name}</p>
      <p className="mt-1 text-muted">{formatDisplayDate(session.workout_date)}</p>

      <dl className="mt-8 grid grid-cols-2 gap-3 text-left">
        <div className="rounded-3xl border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Exercises</dt>
          <dd className="mt-1 text-2xl font-semibold">{completedExercises}</dd>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Rounds</dt>
          <dd className="mt-1 text-2xl font-semibold">{completedRounds || session.rounds}</dd>
        </div>
        <div className="col-span-2 rounded-3xl border border-border bg-surface p-4">
          <dt className="text-sm text-muted">Duration</dt>
          <dd className="mt-1 text-2xl font-semibold">
            {formatDuration(session.duration_seconds) ?? "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-col gap-3">
        <ButtonLink href="/dashboard" size="lg">
          Back to Dashboard
        </ButtonLink>
        <ButtonLink href="/history" variant="secondary" size="lg">
          View History
        </ButtonLink>
      </div>
    </div>
  );
}
