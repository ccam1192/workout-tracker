import { notFound } from "next/navigation";
import { ConfigError } from "@/components/config-error";
import { DeleteTemplateButton } from "@/components/delete-template-button";
import { StartTemplateButton } from "@/components/start-template-button";
import { ButtonLink } from "@/components/ui/button-link";
import { formatExercisePrescription, workoutTypeLabel } from "@/lib/format";
import { requireUser } from "@/lib/supabase/require-user";
import type { WorkoutTemplateWithExercises } from "@/lib/types";

export const metadata = {
  title: "Workout",
};

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, configured } = await requireUser();
  if (!configured || !supabase) {
    return <ConfigError />;
  }

  const { data: template } = await supabase
    .from("workout_templates")
    .select("*, workout_template_exercises(*)")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    notFound();
  }

  const workout = template as WorkoutTemplateWithExercises;
  const exercises = [...(workout.workout_template_exercises ?? [])].sort(
    (a, b) => a.exercise_order - b.exercise_order,
  );

  const { data: inProgress } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("template_id", id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {workoutTypeLabel(workout.workout_type)} · {workout.rounds ?? 1}{" "}
          {(workout.rounds ?? 1) === 1 ? "round" : "rounds"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{workout.name}</h1>
        {workout.description ? <p className="text-muted">{workout.description}</p> : null}
      </header>

      <StartTemplateButton templateId={workout.id} inProgressSessionId={inProgress?.id} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/workouts/${workout.id}/edit`} variant="secondary" className="flex-1">
          Edit
        </ButtonLink>
        <DeleteTemplateButton templateId={workout.id} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Exercises</h2>
        {exercises.map((exercise, index) => (
          <article key={exercise.id} className="rounded-3xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {index + 1}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{exercise.name}</h3>
            <p className="mt-1 text-sm text-muted">
              {formatExercisePrescription(exercise) || "No target specified"}
            </p>
            {exercise.notes ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">{exercise.notes}</p>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
