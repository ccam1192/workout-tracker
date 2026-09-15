"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { useStartWorkout } from "@/hooks/use-start-workout";

export function StartTemplateButton({
  templateId,
  inProgressSessionId,
}: {
  templateId: string;
  inProgressSessionId?: string;
}) {
  const { startWorkout, startingId, error } = useStartWorkout();

  if (inProgressSessionId) {
    return (
      <ButtonLink href={`/workout/${inProgressSessionId}`} size="lg" className="w-full">
        Continue Workout
      </ButtonLink>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert>{error}</Alert> : null}
      <Button
        size="lg"
        className="w-full"
        onClick={() => void startWorkout(templateId)}
        disabled={startingId === templateId}
      >
        {startingId === templateId ? "Starting…" : "Start Workout"}
      </Button>
    </div>
  );
}
