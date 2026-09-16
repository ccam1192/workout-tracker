"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Play, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { HistoryItem } from "@/components/history-item";
import { WorkoutCard } from "@/components/workout-card";
import { useStartWorkout } from "@/hooks/use-start-workout";
import { getLocalWorkoutDate, formatLongDate, getGreeting } from "@/lib/dates";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { TemplateCardData, WorkoutSession } from "@/lib/types";

type DashboardViewProps = {
  templates: TemplateCardData[];
  inProgress: WorkoutSession | null;
  recent: WorkoutSession[];
};

export function DashboardView({ templates, inProgress, recent }: DashboardViewProps) {
  const router = useRouter();
  const now = new Date();
  const greeting = getGreeting(now);
  const todayLabel = formatLongDate(now);
  const { startWorkout, startingId, error } = useStartWorkout();
  const [runError, setRunError] = useState<string | null>(null);
  const [startingRun, setStartingRun] = useState(false);
  const runLock = useRef(false);

  async function handleStartRun() {
    if (runLock.current) return;
    runLock.current = true;
    setStartingRun(true);
    setRunError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data, error: rpcError } = await supabase.rpc("start_run_session", {
        p_workout_date: getLocalWorkoutDate(),
      });

      if (rpcError || !data) throw rpcError ?? new Error("Failed to start run");

      router.push(`/workout/${data}`);
      router.refresh();
    } catch (err) {
      runLock.current = false;
      setStartingRun(false);
      setRunError(getUserFacingError(err, "Could not start the run. Please try again."));
    }
  }

  const runInProgress = inProgress?.workout_type === "run";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">Today</p>
        <h1 suppressHydrationWarning className="mt-2 text-4xl font-semibold tracking-tight">{greeting}</h1>
        <p suppressHydrationWarning className="mt-2 text-muted">{todayLabel || " "}</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}
      {runError ? <Alert>{runError}</Alert> : null}

      {inProgress ? (
        <section className="rounded-3xl border border-accent/40 bg-accent-soft p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            {runInProgress ? "Run in progress" : "Workout in progress"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{inProgress.template_name}</h2>
          <p className="mt-1 text-sm text-muted">Pick up where you left off.</p>
          <ButtonLink href={`/workout/${inProgress.id}`} className="mt-4 w-full" size="lg">
            {runInProgress ? "Continue Run" : "Continue Workout"}
          </ButtonLink>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Quick Start</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => void handleStartRun()}
            disabled={startingRun || !!inProgress}
          >
            <Play className="h-5 w-5" />
            {startingRun ? "Starting…" : "Start Run"}
          </Button>
          <ButtonLink href="/workouts/new" variant="secondary" size="lg" className="w-full">
            New Workout
          </ButtonLink>
        </div>
        <ButtonLink href="/workouts/ai" variant="secondary" size="lg" className="w-full">
          <Sparkles className="h-5 w-5" />
          AI Workout Builder
        </ButtonLink>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-semibold">Your Workouts</h2>
          {templates.length > 0 ? (
            <ButtonLink href="/workouts" variant="ghost" size="sm">
              All
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
