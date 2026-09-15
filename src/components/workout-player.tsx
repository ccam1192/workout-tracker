"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RoundTimer } from "@/components/round-timer";
import { WorkoutExercise } from "@/components/workout-exercise";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionRound,
} from "@/lib/types";

type WorkoutPlayerProps = {
  session: WorkoutSession;
  initialExercises: WorkoutSessionExercise[];
  initialRounds: WorkoutSessionRound[];
};

function currentRoundNumber(exercises: WorkoutSessionExercise[], rounds: number) {
  for (let round = 1; round <= rounds; round += 1) {
    const roundExercises = exercises.filter((exercise) => exercise.round_number === round);
    if (roundExercises.some((exercise) => !exercise.completed)) {
      return round;
    }
  }
  return rounds;
}

function groupExercises(exercises: WorkoutSessionExercise[]) {
  const groups = new Map<string, WorkoutSessionExercise[]>();
  for (const exercise of exercises) {
    const key = `${exercise.round_number}-${exercise.exercise_order}-${exercise.name}`;
    const existing = groups.get(key) ?? [];
    existing.push(exercise);
    groups.set(key, existing);
  }
  return Array.from(groups.values()).map((group) =>
    group.sort((a, b) => a.set_number - b.set_number),
  );
}

export function WorkoutPlayer({
  session,
  initialExercises,
  initialRounds,
}: WorkoutPlayerProps) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [rounds, setRounds] = useState(initialRounds);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pauseStart, setPauseStart] = useState<number | null>(null);
  const [completingRoundNum, setCompletingRoundNum] = useState<number | null>(null);

  const totalRounds = session.rounds || 1;
  const showRounds = session.workout_type === "circuit" || totalRounds > 1;
  const activeRound = currentRoundNumber(exercises, totalRounds);
  const roundRow = rounds.find((round) => round.round_number === activeRound);
  const roundExercises = exercises.filter((exercise) => exercise.round_number === activeRound);
  const completedCount = exercises.filter((exercise) => exercise.completed).length;
  const grouped = groupExercises(roundExercises);

  const elapsedSeconds = useMemo(() => {
    if (!roundRow?.started_at) return 0;
    const started = new Date(roundRow.started_at).getTime();
    const pausedSeconds = roundRow.paused_seconds ?? 0;
    const livePause =
      paused && pauseStart ? Math.floor((now - pauseStart) / 1000) : 0;
    return Math.max(0, Math.floor((now - started) / 1000) - pausedSeconds - livePause);
  }, [now, paused, pauseStart, roundRow]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!paused) setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (!roundRow || roundRow.started_at || roundRow.completed_at) return;
    let cancelled = false;
    const supabase = createClient();
    if (!supabase) return;
    const startedAt = new Date().toISOString();
    supabase
      .from("workout_session_rounds")
      .update({ started_at: startedAt })
      .eq("id", roundRow.id)
      .then(({ error: updateError }) => {
        if (!cancelled && !updateError) {
          setRounds((current) =>
            current.map((round) =>
              round.id === roundRow.id ? { ...round, started_at: startedAt } : round,
            ),
          );
        }
      });
    return () => { cancelled = true; };
  }, [roundRow]);

  const persistRoundDuration = useCallback(async (roundNumber: number, duration: number) => {
    const target = rounds.find((round) => round.round_number === roundNumber);
    if (!target || target.completed_at) return;
    const supabase = createClient();
    if (!supabase) return;
    const completedAt = new Date().toISOString();
    await supabase
      .from("workout_session_rounds")
      .update({
        completed_at: completedAt,
        duration_seconds: duration,
      })
      .eq("id", target.id);
    setRounds((current) =>
      current.map((round) =>
        round.id === target.id
          ? { ...round, completed_at: completedAt, duration_seconds: duration }
          : round,
      ),
    );
  }, [rounds]);

  function checkRoundCompletion(updatedExercises: WorkoutSessionExercise[]) {
    if (completingRoundNum !== null) return;

    const finished = rounds.find((round) => {
      if (round.completed_at) return false;
      const roundItems = updatedExercises.filter(
        (exercise) => exercise.round_number === round.round_number,
      );
      return roundItems.length > 0 && roundItems.every((exercise) => exercise.completed);
    });

    if (!finished) return;

    const currentActiveRound = currentRoundNumber(updatedExercises, totalRounds);
    const duration =
      finished.round_number === currentActiveRound
        ? elapsedSeconds
        : finished.duration_seconds ?? elapsedSeconds;

    setCompletingRoundNum(finished.round_number);
    persistRoundDuration(finished.round_number, duration).finally(() => {
      setCompletingRoundNum(null);
      setPaused(false);
      setPauseStart(null);
    });
  }

  async function toggleExercise(exerciseId: string, completed: boolean) {
    const previous = exercises;
    const completedAt = completed ? new Date().toISOString() : null;
    const updated = exercises.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, completed, completed_at: completedAt }
        : exercise,
    );
    setExercises(updated);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setExercises(previous);
      return;
    }

    const { error: updateError } = await supabase
      .from("workout_session_exercises")
      .update({ completed, completed_at: completedAt })
      .eq("id", exerciseId);

    if (updateError) {
      setExercises(previous);
      setError(getUserFacingError(updateError, "Could not save your progress. Please try again."));
      return;
    }

    checkRoundCompletion(updated);
  }

  async function togglePause() {
    const supabase = createClient();
    if (!roundRow || !supabase) {
      setPaused((value) => !value);
      return;
    }

    if (!paused) {
      setPauseStart(Date.now());
      setPaused(true);
      return;
    }

    const extra = pauseStart
      ? Math.floor((Date.now() - pauseStart) / 1000)
      : 0;
    setPauseStart(null);
    setPaused(false);
    const nextPaused = (roundRow.paused_seconds ?? 0) + extra;
    setRounds((current) =>
      current.map((round) =>
        round.id === roundRow.id ? { ...round, paused_seconds: nextPaused } : round,
      ),
    );
    await supabase
      .from("workout_session_rounds")
      .update({ paused_seconds: nextPaused })
      .eq("id", roundRow.id);
  }

  async function completeWorkout() {
    if (saving) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const unfinishedRound = rounds.find((round) => !round.completed_at);
      if (unfinishedRound) {
        await persistRoundDuration(unfinishedRound.round_number, elapsedSeconds);
      }

      const { error: completeError } = await supabase.rpc("complete_workout_session", {
        p_session_id: session.id,
      });
      if (completeError) throw completeError;

      router.push(`/workout/${session.id}/complete`);
      router.refresh();
    } catch (completeErr) {
      setSaving(false);
      setError(getUserFacingError(completeErr, "Could not complete this workout. Please try again."));
    }
  }

  function requestComplete() {
    if (completedCount < exercises.length) {
      setConfirmComplete(true);
      return;
    }
    void completeWorkout();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-8 pt-4 md:px-6">
      <header className="sticky top-0 z-20 -mx-4 space-y-4 border-b border-border bg-bg/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex items-center gap-3">
          <ButtonLink
            href="/dashboard"
            variant="ghost"
            size="sm"
            className="min-h-11 w-11 px-0"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </ButtonLink>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{session.template_name}</h1>
            {showRounds ? (
              <p className="text-sm font-medium text-accent">
                Round {activeRound} of {totalRounds}
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-sm text-muted">
            <span>
              {completedCount} of {exercises.length} exercises
            </span>
            <span>
              {exercises.length
                ? Math.round((completedCount / exercises.length) * 100)
                : 0}
              %
            </span>
          </div>
          <ProgressBar value={completedCount} max={exercises.length || 1} />
        </div>
        <RoundTimer
          elapsedSeconds={elapsedSeconds}
          paused={paused}
          onTogglePause={() => void togglePause()}
          label={showRounds ? `Round ${activeRound} time` : "Workout time"}
        />
      </header>

      <div className="flex-1 space-y-4 py-5">
        {error ? <Alert>{error}</Alert> : null}
        {grouped.map((group) => (
          <WorkoutExercise
            key={`${group[0].round_number}-${group[0].exercise_order}-${group[0].id}`}
            exercises={group}
            onToggle={(id, completed) => void toggleExercise(id, completed)}
          />
        ))}
      </div>

      <div
        className="sticky bottom-0 -mx-4 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur md:-mx-6 md:px-6"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          size="lg"
          className="w-full"
          onClick={requestComplete}
          disabled={saving}
        >
          {saving ? "Finishing…" : "Complete Workout"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmComplete}
        title="Finish workout anyway?"
        description="You haven't completed every exercise. You can keep going or complete the workout now."
        confirmLabel="Complete Anyway"
        cancelLabel="Continue Workout"
        busy={saving}
        onCancel={() => setConfirmComplete(false)}
        onConfirm={() => {
          setConfirmComplete(false);
          void completeWorkout();
        }}
      />
    </div>
  );
}
