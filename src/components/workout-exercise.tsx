"use client";

import { Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatExercisePrescription } from "@/lib/format";
import type { WorkoutSessionExercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isValidYoutubeUrl } from "@/lib/youtube";

type WorkoutExerciseProps = {
  exercises: WorkoutSessionExercise[];
  onToggle: (exerciseId: string, completed: boolean) => void;
  disabled?: boolean;
};

export function WorkoutExercise({ exercises, onToggle, disabled }: WorkoutExerciseProps) {
  const first = exercises[0];
  if (!first) return null;

  const allComplete = exercises.every((exercise) => exercise.completed);
  const showSets = exercises.length > 1;
  const hasVideo = first.video_url && isValidYoutubeUrl(first.video_url);

  return (
    <article
      className={cn(
        "rounded-3xl border p-5 transition",
        allComplete
          ? "border-accent/40 bg-accent-soft/60"
          : "border-border bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3
            className={cn(
              "text-2xl font-semibold tracking-tight",
              allComplete && "text-accent",
            )}
          >
            {first.name}
          </h3>
          <p className="mt-1 text-muted">{formatExercisePrescription(first) || "Complete when ready"}</p>
        </div>
        {!showSets ? (
          <button
            type="button"
            aria-pressed={first.completed}
            aria-label={first.completed ? "Mark incomplete" : "Mark complete"}
            disabled={disabled}
            onClick={() => onToggle(first.id, !first.completed)}
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 transition",
              first.completed
                ? "border-accent bg-accent text-accent-text"
                : "border-border bg-bg text-muted",
            )}
          >
            <Check className="h-7 w-7" strokeWidth={3} />
          </button>
        ) : null}
      </div>

      {showSets ? (
        <div className="mt-4 space-y-2">
          {exercises.map((exercise, index) => (
            <button
              key={exercise.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(exercise.id, !exercise.completed)}
              className={cn(
                "flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left font-medium transition",
                exercise.completed
                  ? "border-accent/40 bg-accent text-accent-text"
                  : "border-border bg-bg text-text",
              )}
            >
              <span>Set {index + 1}</span>
              <Check className="h-5 w-5" strokeWidth={3} />
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(first.id, !first.completed)}
          className="mt-4 flex min-h-12 items-center gap-3 text-left text-base font-medium"
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md border",
              first.completed ? "border-accent bg-accent text-accent-text" : "border-muted text-transparent",
            )}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
          Completed
        </button>
      )}

      {first.notes ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          <span className="font-semibold text-text">Notes: </span>
          {first.notes}
        </p>
      ) : null}

      {hasVideo ? (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => window.open(first.video_url!, "_blank", "noopener,noreferrer")}
        >
          <Play className="h-4 w-4" />
          Watch Form
        </Button>
      ) : null}
    </article>
  );
}
