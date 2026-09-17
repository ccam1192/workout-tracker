"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkoutSessionExercise } from "@/lib/types";
import { hasFormGuidance } from "@/lib/workout-tracking";
import { isValidYoutubeUrl } from "@/lib/youtube";

type FormGuidanceProps = {
  exercise: WorkoutSessionExercise;
};

export function FormGuidance({ exercise }: FormGuidanceProps) {
  const [open, setOpen] = useState(false);

  if (!hasFormGuidance(exercise)) {
    return null;
  }

  const hasVideo = Boolean(exercise.video_url && isValidYoutubeUrl(exercise.video_url));

  return (
    <div className="mt-3 rounded-2xl bg-bg/70">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-muted"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        How to do it
      </button>

      {open ? (
        <div className="space-y-2 px-3 pb-3 text-sm leading-relaxed text-muted">
          {exercise.description ? <p>{exercise.description}</p> : null}
          {exercise.form_instructions ? (
            <p>
              <span className="font-semibold text-text">Form: </span>
              {exercise.form_instructions}
            </p>
          ) : null}
          {exercise.primary_muscles ? (
            <p>
              <span className="font-semibold text-text">Muscles: </span>
              {exercise.primary_muscles}
            </p>
          ) : null}
          {exercise.equipment ? (
            <p>
              <span className="font-semibold text-text">Equipment: </span>
              {exercise.equipment}
            </p>
          ) : null}
          {hasVideo ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => window.open(exercise.video_url!, "_blank", "noopener,noreferrer")}
            >
              <Play className="h-4 w-4" />
              Watch Form
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
