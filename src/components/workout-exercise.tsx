"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FormGuidance } from "@/components/form-guidance";
import { inputClassName } from "@/components/ui/field";
import type { WorkoutSessionExercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  formatPlannedTarget,
  shouldShowDuration,
  shouldShowReps,
  shouldShowWeight,
  type SetDraft,
} from "@/lib/workout-tracking";

type WorkoutExerciseProps = {
  exercises: WorkoutSessionExercise[];
  drafts: Record<string, SetDraft>;
  onDraftChange: (exerciseId: string, patch: Partial<SetDraft>) => void;
  onToggle: (exerciseId: string, completed: boolean) => void;
  disabled?: boolean;
  circuitMode?: boolean;
};

const compactInputClassName = cn(
  inputClassName,
  "min-h-12 px-3 text-center text-xl font-semibold tabular-nums",
);

export function WorkoutExercise({
  exercises,
  drafts,
  onDraftChange,
  onToggle,
  disabled,
  circuitMode = false,
}: WorkoutExerciseProps) {
  const first = exercises[0];
  const initialNotes = (first?.notes ?? "").trim();
  const [showNotes, setShowNotes] = useState(Boolean(initialNotes));
  if (!first) return null;

  const allComplete = exercises.every((exercise) => exercise.completed);
  const showSets = exercises.length > 1;
  const notesId = first.id;
  const notesValue = (drafts[notesId] ?? { notes: first.notes ?? "" }).notes;
  const notesDuplicateForm =
    Boolean(notesValue.trim()) && notesValue.trim() === (first.form_instructions ?? "").trim();

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
        <div className="min-w-0">
          <h3
            className={cn(
              "text-2xl font-semibold tracking-tight",
              allComplete && "text-accent",
            )}
          >
            {first.name}
          </h3>
          <p className="mt-1 text-sm text-muted">
            Planned: {formatPlannedTarget(first) || "Complete when ready"}
          </p>
        </div>
        {!showSets && !circuitMode ? (
          <CompleteButton
            completed={first.completed}
            disabled={disabled}
            onToggle={() => onToggle(first.id, !first.completed)}
            label={first.name}
          />
        ) : null}
      </div>

      <FormGuidance exercise={first} />

      <div className="mt-4 space-y-3">
        {exercises.map((exercise, index) => (
          <SetEditor
            key={exercise.id}
            exercise={exercise}
            draft={drafts[exercise.id]}
            showSetLabel={showSets}
            setLabel={showSets ? `Set ${index + 1}` : circuitMode ? "Actual" : "Actual"}
            showComplete={showSets || circuitMode}
            disabled={disabled}
            onDraftChange={onDraftChange}
            onToggle={onToggle}
          />
        ))}
      </div>

      {notesDuplicateForm ? null : showNotes ? (
        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
            Notes
          </span>
          <input
            className={cn(inputClassName, "min-h-11 text-sm")}
            value={notesValue}
            disabled={disabled}
            placeholder="Optional"
            onChange={(event) => {
              for (const exercise of exercises) {
                onDraftChange(exercise.id, { notes: event.target.value });
              }
            }}
          />
        </label>
      ) : (
        <button
          type="button"
          className="mt-4 min-h-11 text-sm font-semibold text-muted"
          onClick={() => setShowNotes(true)}
        >
          Add note
        </button>
      )}
    </article>
  );
}

function SetEditor({
  exercise,
  draft,
  showSetLabel,
  setLabel,
  showComplete,
  disabled,
  onDraftChange,
  onToggle,
}: {
  exercise: WorkoutSessionExercise;
  draft?: SetDraft;
  showSetLabel: boolean;
  setLabel: string;
  showComplete: boolean;
  disabled?: boolean;
  onDraftChange: (exerciseId: string, patch: Partial<SetDraft>) => void;
  onToggle: (exerciseId: string, completed: boolean) => void;
}) {
  const value: SetDraft = draft ?? {
    reps: "",
    weight: "",
    duration: "",
    unit: exercise.weight_unit || "lb",
    notes: exercise.notes ?? "",
  };
  const showReps = shouldShowReps(exercise);
  const showDuration = shouldShowDuration(exercise);
  const showWeight = shouldShowWeight(exercise) || Boolean(value.weight);

  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3",
        exercise.completed ? "border-accent/40 bg-accent/10" : "border-border bg-bg",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{setLabel}</p>
          {showSetLabel ? (
            <p className="text-xs text-muted">
              Planned: {formatPlannedTarget(exercise) || "—"}
            </p>
          ) : null}
        </div>
        {showComplete ? (
          <CompleteButton
            completed={exercise.completed}
            disabled={disabled}
            onToggle={() => onToggle(exercise.id, !exercise.completed)}
            label={`${exercise.name} ${setLabel}`}
            compact
          />
        ) : null}
      </div>

      <div className={cn("grid gap-2", showWeight ? "grid-cols-2" : "grid-cols-1")}>
        {showReps ? (
          <label className="min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Reps
            </span>
            <input
              className={compactInputClassName}
              inputMode="numeric"
              pattern="[0-9]*"
              value={value.reps}
              disabled={disabled}
              onChange={(event) => onDraftChange(exercise.id, { reps: event.target.value })}
            />
          </label>
        ) : null}

        {showDuration ? (
          <label className="min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Seconds
            </span>
            <input
              className={compactInputClassName}
              inputMode="numeric"
              pattern="[0-9]*"
              value={value.duration}
              disabled={disabled}
              onChange={(event) => onDraftChange(exercise.id, { duration: event.target.value })}
            />
          </label>
        ) : null}

        {showWeight ? (
          <label className="min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              Weight
            </span>
            <div className="flex gap-2">
              <input
                className={cn(compactInputClassName, "min-w-0 flex-1")}
                inputMode="decimal"
                value={value.weight}
                disabled={disabled}
                onChange={(event) => onDraftChange(exercise.id, { weight: event.target.value })}
              />
              <select
                className={cn(inputClassName, "w-20 min-h-12 px-2 text-center font-semibold")}
                value={value.unit}
                disabled={disabled}
                onChange={(event) => onDraftChange(exercise.id, { unit: event.target.value })}
                aria-label="Weight unit"
              >
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </label>
        ) : null}
      </div>
    </div>
  );
}

function CompleteButton({
  completed,
  disabled,
  onToggle,
  label,
  compact = false,
}: {
  completed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={completed}
      aria-label={completed ? `Mark ${label} incomplete` : `Mark ${label} complete`}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl border-2 transition",
        compact ? "h-12 w-12" : "h-14 w-14",
        completed
          ? "border-accent bg-accent text-accent-text"
          : "border-border bg-bg text-muted",
      )}
    >
      <Check className={compact ? "h-6 w-6" : "h-7 w-7"} strokeWidth={3} />
    </button>
  );
}
