import { Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { workoutTypeLabel } from "@/lib/format";
import type { TemplateCardData } from "@/lib/types";

type WorkoutCardProps = {
  template: TemplateCardData;
  inProgressSessionId?: string | null;
  starting?: boolean;
  onStart?: () => void;
  showManageActions?: boolean;
};

export function WorkoutCard({
  template,
  inProgressSessionId,
  starting = false,
  onStart,
  showManageActions = false,
}: WorkoutCardProps) {
  const rounds = template.rounds ?? 1;

  return (
    <article className="flex flex-col rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold leading-tight">
            <a href={`/workouts/${template.id}`} className="hover:underline">
              {template.name}
            </a>
          </h3>
          {template.description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {template.description}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          {workoutTypeLabel(template.workout_type)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
        <span className="rounded-full border border-border px-3 py-1">
          {template.exerciseCount} {template.exerciseCount === 1 ? "exercise" : "exercises"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
          <Repeat2 className="h-3.5 w-3.5" />
          {rounds} {rounds === 1 ? "round" : "rounds"}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {inProgressSessionId ? (
          <ButtonLink href={`/workout/${inProgressSessionId}`} className="w-full" size="lg">
            Continue Workout
          </ButtonLink>
        ) : (
          <Button
            className="w-full"
            size="lg"
            onClick={onStart}
            disabled={starting || !onStart}
          >
            {starting ? "Starting…" : "Start Workout"}
          </Button>
        )}
        {showManageActions ? (
          <div className="grid grid-cols-2 gap-3">
            <ButtonLink
              href={`/workouts/${template.id}/edit`}
              variant="secondary"
              className="w-full"
            >
              Edit
            </ButtonLink>
            <ButtonLink
              href={`/workouts/${template.id}`}
              variant="ghost"
              className="w-full"
            >
              Details
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </article>
  );
}
