"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ExerciseForm } from "@/components/exercise-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import { draftToExerciseInsert, emptyExerciseDraft, validateExerciseDraft } from "@/lib/exercises";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ExerciseDraft, WorkoutTemplateWithExercises, WorkoutType } from "@/lib/types";
import { cn } from "@/lib/utils";

type WorkoutFormProps = {
  template?: WorkoutTemplateWithExercises;
};

export function WorkoutForm({ template }: WorkoutFormProps) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [workoutType, setWorkoutType] = useState<WorkoutType>(
    template?.workout_type ?? "circuit",
  );
  const [rounds, setRounds] = useState(String(template?.rounds ?? 3));
  const [exercises, setExercises] = useState<ExerciseDraft[]>(
    template?.workout_template_exercises?.length
      ? [...template.workout_template_exercises]
          .sort((a, b) => a.exercise_order - b.exercise_order)
          .map((exercise) => ({
            key: exercise.id,
            id: exercise.id,
            name: exercise.name,
            sets: exercise.sets?.toString() ?? "",
            repetitions: exercise.repetitions ?? "",
            duration_seconds: exercise.duration_seconds?.toString() ?? "",
            weight: exercise.weight?.toString() ?? "",
            weight_unit: exercise.weight_unit ?? "lb",
            rest_seconds: exercise.rest_seconds?.toString() ?? "",
            notes: exercise.notes ?? "",
            video_url: exercise.video_url ?? "",
          }))
      : [emptyExerciseDraft()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function moveExercise(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= exercises.length) return;
    const next = [...exercises];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setExercises(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give this workout a name.");
      return;
    }

    const parsedRounds = Number.parseInt(rounds, 10);
    if (!Number.isFinite(parsedRounds) || parsedRounds < 1) {
      setError("Rounds must be at least 1.");
      return;
    }

    if (exercises.length === 0) {
      setError("Add at least one exercise.");
      return;
    }

    for (let index = 0; index < exercises.length; index += 1) {
      const exerciseError = validateExerciseDraft(exercises[index], index);
      if (exerciseError) {
        setError(exerciseError);
        return;
      }
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw userError ?? new Error("Not authenticated");
      }

      let templateId = template?.id;

      if (templateId) {
        const { error: updateError } = await supabase
          .from("workout_templates")
          .update({
            name: trimmedName,
            description: description.trim() || null,
            workout_type: workoutType,
            rounds: parsedRounds,
          })
          .eq("id", templateId)
          .eq("user_id", user.id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from("workout_template_exercises")
          .delete()
          .eq("template_id", templateId);

        if (deleteError) throw deleteError;
      } else {
        const { data, error: insertError } = await supabase
          .from("workout_templates")
          .insert({
            user_id: user.id,
            name: trimmedName,
            description: description.trim() || null,
            workout_type: workoutType,
            rounds: parsedRounds,
          })
          .select("id")
          .single();

        if (insertError || !data) throw insertError ?? new Error("Insert failed");
        templateId = data.id;
      }

      const payload = exercises.map((exercise, index) =>
        draftToExerciseInsert(exercise, templateId!, index + 1),
      );

      const { error: exercisesError } = await supabase
        .from("workout_template_exercises")
        .insert(payload);

      if (exercisesError) throw exercisesError;

      router.push(`/workouts/${templateId}`);
      router.refresh();
    } catch (submitError) {
      setError(getUserFacingError(submitError, "Could not save this workout. Please try again."));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}

      <Field label="Workout name" htmlFor="workout-name">
        <input
          id="workout-name"
          className={inputClassName}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Morning Calisthenics"
          required
        />
      </Field>

      <Field label="Description" htmlFor="workout-description">
        <textarea
          id="workout-description"
          className={textareaClassName}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this workout is for"
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted">Workout type</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["standard", "Standard Workout"],
              ["circuit", "Circuit"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setWorkoutType(value)}
              className={cn(
                "min-h-14 rounded-2xl border px-4 text-sm font-semibold transition",
                workoutType === value
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-surface text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field
        label="Number of rounds"
        htmlFor="workout-rounds"
        hint={
          workoutType === "circuit"
            ? "Complete every exercise in a round, then repeat."
            : "Usually 1 for a standard workout."
        }
      >
        <input
          id="workout-rounds"
          className={cn(inputClassName, workoutType === "circuit" && "border-accent")}
          inputMode="numeric"
          value={rounds}
          onChange={(event) => setRounds(event.target.value)}
        />
      </Field>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Exercises</h2>
          <span className="text-sm text-muted">{exercises.length}</span>
        </div>
        {exercises.map((exercise, index) => (
          <ExerciseForm
            key={exercise.key}
            index={index}
            exercise={exercise}
            canMoveUp={index > 0}
            canMoveDown={index < exercises.length - 1}
            onChange={(next) => {
              const copy = [...exercises];
              copy[index] = next;
              setExercises(copy);
            }}
            onMoveUp={() => moveExercise(index, -1)}
            onMoveDown={() => moveExercise(index, 1)}
            onDelete={() => {
              setExercises(exercises.filter((_, exerciseIndex) => exerciseIndex !== index));
            }}
          />
        ))}
        <Button
          variant="secondary"
          className="w-full"
          size="lg"
          onClick={() => setExercises([...exercises, emptyExerciseDraft()])}
        >
          <Plus className="h-5 w-5" />
          Add exercise
        </Button>
      </div>

      <div className="sticky bottom-24 z-10 pt-2 md:bottom-4">
        <Button type="submit" size="lg" className="w-full shadow-lg shadow-black/30" disabled={saving}>
          {saving ? "Saving…" : "Save Workout"}
        </Button>
      </div>
    </form>
  );
}
