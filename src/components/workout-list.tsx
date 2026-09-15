"use client";

import { Alert } from "@/components/ui/alert";
import { WorkoutCard } from "@/components/workout-card";
import { useStartWorkout } from "@/hooks/use-start-workout";
import type { TemplateCardData } from "@/lib/types";

type WorkoutListProps = {
  templates: TemplateCardData[];
  inProgressByTemplate: Record<string, string>;
};

export function WorkoutList({ templates, inProgressByTemplate }: WorkoutListProps) {
  const { startWorkout, startingId, error } = useStartWorkout();

  return (
    <div className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <WorkoutCard
            key={template.id}
            template={template}
            inProgressSessionId={inProgressByTemplate[template.id]}
            starting={startingId === template.id}
            onStart={() => void startWorkout(template.id)}
            showManageActions
          />
        ))}
      </div>
    </div>
  );
}
