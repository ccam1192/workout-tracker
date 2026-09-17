"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  createSetDraft,
  draftToActualFields,
  groupSessionExercises,
  type SetDraft,
} from "@/lib/workout-tracking";

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

function initialDrafts(exercises: WorkoutSessionExercise[]) {
  return Object.fromEntries(exercises.map((exercise) => [exercise.id, createSetDraft(exercise)]));
}

export function WorkoutPlayer({
  session,
  initialExercises,
  initialRounds,
}: WorkoutPlayerProps) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [rounds, setRounds] = useState(initialRounds);
  const [drafts, setDrafts] = useState<Record<string, SetDraft>>(() => initialDrafts(initialExercises));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pauseStart, setPauseStart] = useState<number | null>(null);
  const [completingRoundNum, setCompletingRoundNum] = useState<number | null>(null);
  const [completingRound, setCompletingRound] = useState(false);

  const dirtyIds = useRef(new Set<string>());
  const exercisesRef = useRef(exercises);
  const draftsRef = useRef(drafts);
  const persistTimer = useRef<number | null>(null);

  useEffect(() => {
    exercisesRef.current = exercises;
  }, [exercises]);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const totalRounds = session.rounds || 1;
  const isCircuit = session.workout_type === "circuit";
  const showRounds = isCircuit || totalRounds > 1;
  const activeRound = currentRoundNumber(exercises, totalRounds);
  const roundRow = rounds.find((round) => round.round_number === activeRound);
  const roundExercises = exercises.filter((exercise) => exercise.round_number === activeRound);
  const completedCount = exercises.filter((exercise) => exercise.completed).length;
  const grouped = groupSessionExercises(roundExercises);
  const roundComplete = roundExercises.length > 0 && roundExercises.every((exercise) => exercise.completed);

  const elapsedSeconds = useMemo(() => {
    if (!roundRow?.started_at) return 0;
    const started = new Date(roundRow.started_at).getTime();
    const pausedSeconds = roundRow.paused_seconds ?? 0;
    const livePause =
      paused && pauseStart ? Math.floor((now - pauseStart) / 1000) : 0;
    return Math.max(0, Math.floor((now - started) / 1000) - pausedSeconds - livePause);
  }, [now, paused, pauseStart, roundRow]);

  const persistExercises = useCallback(async (ids: string[], nextExercises?: WorkoutSessionExercise[]) => {
    if (ids.length === 0) return true;
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return false;
    }

    const currentExercises = nextExercises ?? exercisesRef.current;
    const currentDrafts = draftsRef.current;
    const uniqueIds = Array.from(new Set(ids));

    const results = await Promise.all(
      uniqueIds.map(async (id) => {
        const exercise = currentExercises.find((item) => item.id === id);
        if (!exercise) return { id, error: null };
        const draft = currentDrafts[id] ?? createSetDraft(exercise);
        const actual = draftToActualFields(draft);
        const { error: updateError } = await supabase
          .from("workout_session_exercises")
          .update({
            completed: exercise.completed,
            completed_at: exercise.completed_at,
            repetitions_completed: actual.repetitions_completed,
            duration_seconds_completed: actual.duration_seconds_completed,
            weight_used: actual.weight_used,
            weight_unit: actual.weight_used != null
              ? actual.weight_unit ?? exercise.weight_unit
              : exercise.weight_unit,
            notes: actual.notes,
          })
          .eq("id", id);
        return { id, error: updateError };
      }),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setError(getUserFacingError(failed.error, "Could not save your progress. Please try again."));
      return false;
    }

    for (const id of uniqueIds) {
      dirtyIds.current.delete(id);
    }
    return true;
  }, []);

  const flushDirty = useCallback(async (ids?: string[]) => {
    const targetIds = ids ?? Array.from(dirtyIds.current);
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    return persistExercises(targetIds);
  }, [persistExercises]);

  const schedulePersist = useCallback((id: string) => {
    dirtyIds.current.add(id);
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
    }
    persistTimer.current = window.setTimeout(() => {
      void persistExercises(Array.from(dirtyIds.current));
    }, 800);
  }, [persistExercises]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!paused) setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    function handleHide() {
      if (document.visibilityState === "hidden") {
        void flushDirty();
      }
    }
    function handlePageHide() {
      void flushDirty();
    }
    document.addEventListener("visibilitychange", handleHide);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleHide);
      window.removeEventListener("pagehide", handlePageHide);
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [flushDirty]);

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

  function handleDraftChange(exerciseId: string, patch: Partial<SetDraft>) {
    const exercise = exercisesRef.current.find((item) => item.id === exerciseId);
    const existing = draftsRef.current[exerciseId];
    const base = existing ?? (exercise
      ? createSetDraft(exercise)
      : { reps: "", weight: "", duration: "", unit: "lb", notes: "" });
    const nextDraft = { ...base, ...patch };
    draftsRef.current = { ...draftsRef.current, [exerciseId]: nextDraft };
    setDrafts((current) => ({ ...current, [exerciseId]: nextDraft }));
    schedulePersist(exerciseId);
  }

  async function toggleExercise(exerciseId: string, completed: boolean) {
    const previous = exercises;
    const completedAt = completed ? new Date().toISOString() : null;
    const updated = exercises.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, completed, completed_at: completedAt }
        : exercise,
    );
    exercisesRef.current = updated;
    setExercises(updated);

    const saved = await persistExercises([exerciseId], updated);
    if (!saved) {
      setExercises(previous);
      return;
    }

    checkRoundCompletion(updated);
  }

  async function completeRound() {
    if (completingRound || roundComplete) return;
    setCompletingRound(true);
    setError(null);

    const previous = exercises;
    const completedAt = new Date().toISOString();
    const roundIds = roundExercises.map((exercise) => exercise.id);
    const updated = exercises.map((exercise) =>
      exercise.round_number === activeRound
        ? { ...exercise, completed: true, completed_at: exercise.completed_at ?? completedAt }
        : exercise,
    );
    exercisesRef.current = updated;
    setExercises(updated);

    const saved = await persistExercises(roundIds, updated);
    if (!saved) {
      setExercises(previous);
      setCompletingRound(false);
      return;
    }

    checkRoundCompletion(updated);
    setCompletingRound(false);
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

      exercisesRef.current = exercises;
      draftsRef.current = drafts;

      const saved = await flushDirty(exercises.map((exercise) => exercise.id));
      if (!saved) {
        throw new Error("Could not save your set details before finishing.");
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
              {completedCount} of {exercises.length} {isCircuit ? "exercises" : "sets"}
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
            drafts={drafts}
            circuitMode={isCircuit}
            onDraftChange={handleDraftChange}
            onToggle={(id, completed) => void toggleExercise(id, completed)}
          />
        ))}

        {isCircuit && !roundComplete ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() => void completeRound()}
            disabled={completingRound}
          >
            {completingRound ? "Saving round…" : `Complete Round ${activeRound}`}
          </Button>
        ) : null}
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
