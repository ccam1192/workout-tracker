"use client";

import { Dumbbell } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { HistoryItem } from "@/components/history-item";
import { WorkoutCard } from "@/components/workout-card";
import { useStartWorkout } from "@/hooks/use-start-workout";
import { formatLongDate, getGreeting } from "@/lib/dates";
import type { TemplateCardData, WorkoutSession } from "@/lib/types";

type DashboardViewProps = {
  templates: TemplateCardData[];
  inProgress: WorkoutSession | null;
  recent: WorkoutSession[];
};

export function DashboardView({ templates, inProgress, recent }: DashboardViewProps) {
  const now = new Date();
  const greeting = getGreeting(now);
  const todayLabel = formatLongDate(now);
  const { startWorkout, startingId, error } = useStartWorkout();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Today</p>
        <h1 suppressHydrationWarning className="mt-2 text-4xl font-semibold tracking-tight">{greeting}</h1>
        <p suppressHydrationWarning className="mt-2 text-muted">{todayLabel || " "}</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      {inProgress ? (
        <section className="rounded-3xl border border-accent/40 bg-accent-soft p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Workout in progress
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{inProgress.template_name}</h2>
          <p className="mt-1 text-sm text-muted">Pick up where you left off.</p>
          <ButtonLink href={`/workout/${inProgress.id}`} className="mt-4 w-full" size="lg">
            Continue Workout
          </ButtonLink>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Today&apos;s Workout</h2>
          {templates.length > 0 ? (
            <ButtonLink href="/workouts/new" variant="ghost" size="sm">
              New
            </ButtonLink>
          ) : null}
        </div>

        {templates.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            description="Create your first workout to get started."
            actionHref="/workouts/new"
            actionLabel="Create Your First Workout"
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((template) => (
              <WorkoutCard
                key={template.id}
                template={template}
                inProgressSessionId={
                  inProgress?.template_id === template.id ? inProgress.id : null
                }
                starting={startingId === template.id}
                onStart={() => void startWorkout(template.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">Recent</h2>
          <ButtonLink href="/history" variant="ghost" size="sm">
            History
          </ButtonLink>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border px-5 py-8 text-center text-muted">
            {inProgress ? "Finish your current workout to add it to history." : "You're all caught up."}
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((session) => (
              <HistoryItem key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
