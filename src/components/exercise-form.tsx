"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import type { ExerciseDraft } from "@/lib/types";

type ExerciseFormProps = {
  index: number;
  exercise: ExerciseDraft;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (exercise: ExerciseDraft) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
};

export function ExerciseForm({
  index,
  exercise,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: ExerciseFormProps) {
  function update<K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) {
    onChange({ ...exercise, [key]: value });
  }

  return (
    <article className="rounded-3xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Exercise {index + 1}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Move up"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="min-h-11 w-11 px-0"
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Move down"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="min-h-11 w-11 px-0"
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            aria-label="Delete exercise"
            onClick={onDelete}
            className="min-h-11 w-11 px-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Exercise name" htmlFor={`${exercise.key}-name`}>
          <input
            id={`${exercise.key}-name`}
            className={inputClassName}
            value={exercise.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Push-ups"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sets" htmlFor={`${exercise.key}-sets`}>
            <input
              id={`${exercise.key}-sets`}
              className={inputClassName}
              inputMode="numeric"
              value={exercise.sets}
              onChange={(event) => update("sets", event.target.value)}
              placeholder="3"
            />
          </Field>
          <Field label="Repetitions" htmlFor={`${exercise.key}-reps`}>
            <input
              id={`${exercise.key}-reps`}
              className={inputClassName}
              value={exercise.repetitions}
              onChange={(event) => update("repetitions", event.target.value)}
              placeholder="10-15"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (sec)" htmlFor={`${exercise.key}-duration`}>
            <input
              id={`${exercise.key}-duration`}
              className={inputClassName}
              inputMode="numeric"
              value={exercise.duration_seconds}
              onChange={(event) => update("duration_seconds", event.target.value)}
              placeholder="45"
            />
          </Field>
          <Field label="Rest (sec)" htmlFor={`${exercise.key}-rest`}>
            <input
              id={`${exercise.key}-rest`}
              className={inputClassName}
              inputMode="numeric"
              value={exercise.rest_seconds}
              onChange={(event) => update("rest_seconds", event.target.value)}
              placeholder="30"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight" htmlFor={`${exercise.key}-weight`}>
            <input
              id={`${exercise.key}-weight`}
              className={inputClassName}
              inputMode="decimal"
              value={exercise.weight}
              onChange={(event) => update("weight", event.target.value)}
              placeholder="Optional"
            />
          </Field>
          <Field label="Unit" htmlFor={`${exercise.key}-unit`}>
            <select
              id={`${exercise.key}-unit`}
              className={inputClassName}
              value={exercise.weight_unit}
              onChange={(event) => update("weight_unit", event.target.value)}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
          </Field>
        </div>

        <Field label="Notes" htmlFor={`${exercise.key}-notes`}>
          <textarea
            id={`${exercise.key}-notes`}
            className={textareaClassName}
            value={exercise.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Form cues, modifications, reminders"
          />
        </Field>

        <Field
          label="YouTube video URL"
          htmlFor={`${exercise.key}-video`}
          hint="Optional form video. Opens in a new tab during the workout."
        >
          <input
            id={`${exercise.key}-video`}
            className={inputClassName}
            value={exercise.video_url}
            onChange={(event) => update("video_url", event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            inputMode="url"
          />
        </Field>
      </div>
    </article>
  );
}
