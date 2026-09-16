"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ExerciseLibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type CreateExerciseFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (exercise: ExerciseLibraryEntry) => void;
};

const CATEGORIES = [
  "Calisthenics",
  "Weight Training",
  "Core",
  "Cardio",
  "Other",
] as const;

const EQUIPMENT_TYPES = [
  { value: "bodyweight", label: "Bodyweight" },
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "machine", label: "Machine" },
  { value: "cable", label: "Cable" },
  { value: "other", label: "Other" },
] as const;

export function CreateExerciseForm({ open, onClose, onCreated }: CreateExerciseFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Calisthenics");
  const [description, setDescription] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [primaryMuscles, setPrimaryMuscles] = useState("");
  const [equipment, setEquipment] = useState("");
  const [exerciseType, setExerciseType] = useState("bodyweight");
  const [defaultReps, setDefaultReps] = useState("");
  const [defaultDuration, setDefaultDuration] = useState("");
  const [defaultWeight, setDefaultWeight] = useState("");
  const [defaultWeightUnit, setDefaultWeightUnit] = useState("lb");
  const [defaultRest, setDefaultRest] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName("");
    setCategory("Calisthenics");
    setDescription("");
    setFormInstructions("");
    setPrimaryMuscles("");
    setEquipment("");
    setExerciseType("bodyweight");
    setDefaultReps("");
    setDefaultDuration("");
    setDefaultWeight("");
    setDefaultWeightUnit("lb");
    setDefaultRest("");
    setVideoUrl("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give this exercise a name.");
      return;
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
      if (userError || !user) throw userError ?? new Error("Not authenticated");

      const durationParsed = defaultDuration.trim()
        ? Number.parseInt(defaultDuration.trim(), 10)
        : null;
      const weightParsed = defaultWeight.trim()
        ? Number.parseFloat(defaultWeight.trim())
        : null;
      const restParsed = defaultRest.trim()
        ? Number.parseInt(defaultRest.trim(), 10)
        : null;

      const { data, error: insertError } = await supabase
        .from("exercise_library")
        .insert({
          user_id: user.id,
          name: trimmedName,
          category,
          description: description.trim() || null,
          form_instructions: formInstructions.trim() || null,
          primary_muscles: primaryMuscles.trim() || null,
          equipment: equipment.trim() || null,
          exercise_type: exerciseType,
          default_repetitions: defaultReps.trim() || null,
          default_duration_seconds: Number.isFinite(durationParsed) ? durationParsed : null,
          default_weight: Number.isFinite(weightParsed) ? weightParsed : null,
          default_weight_unit: weightParsed ? defaultWeightUnit : null,
          default_rest_seconds: Number.isFinite(restParsed) ? restParsed : null,
          video_url: videoUrl.trim() || null,
          is_system_exercise: false,
        })
        .select("*")
        .single();

      if (insertError || !data) throw insertError ?? new Error("Failed to create exercise");

      resetForm();
      onCreated(data as ExerciseLibraryEntry);
    } catch (err) {
      setError(getUserFacingError(err, "Could not save this exercise."));
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-bg sm:h-[80dvh] sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { resetForm(); onClose(); }}
            aria-label="Back"
            className="min-h-11 w-11 px-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">Create New Exercise</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-4 px-5 py-4">
            {error ? <Alert>{error}</Alert> : null}

            <Field label="Exercise name" htmlFor="new-exercise-name">
              <input
                id="new-exercise-name"
                className={inputClassName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Single-Leg Box Squat"
                required
                autoFocus
              />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-muted">Category</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      category === cat
                        ? "bg-accent text-accent-text"
                        : "bg-surface text-muted",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label="Equipment type" htmlFor="new-exercise-type">
              <select
                id="new-exercise-type"
                className={inputClassName}
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
              >
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Description" htmlFor="new-exercise-desc">
              <textarea
                id="new-exercise-desc"
                className={textareaClassName}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this exercise"
              />
            </Field>

            <Field label="Form instructions" htmlFor="new-exercise-form">
              <textarea
                id="new-exercise-form"
                className={textareaClassName}
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                placeholder="How to perform this exercise with good form"
              />
            </Field>

            <Field label="Primary muscles" htmlFor="new-exercise-muscles">
              <input
                id="new-exercise-muscles"
                className={inputClassName}
                value={primaryMuscles}
                onChange={(e) => setPrimaryMuscles(e.target.value)}
                placeholder="e.g. Quads, glutes"
              />
            </Field>

            <Field label="Equipment" htmlFor="new-exercise-equipment">
              <input
                id="new-exercise-equipment"
                className={inputClassName}
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g. Barbell, bench"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Default reps" htmlFor="new-exercise-reps">
                <input
                  id="new-exercise-reps"
                  className={inputClassName}
                  value={defaultReps}
                  onChange={(e) => setDefaultReps(e.target.value)}
                  placeholder="10-15"
                />
              </Field>
              <Field label="Default duration (sec)" htmlFor="new-exercise-dur">
                <input
                  id="new-exercise-dur"
                  className={inputClassName}
                  inputMode="numeric"
                  value={defaultDuration}
                  onChange={(e) => setDefaultDuration(e.target.value)}
                  placeholder="45"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Default weight" htmlFor="new-exercise-weight">
                <input
                  id="new-exercise-weight"
                  className={inputClassName}
                  inputMode="decimal"
                  value={defaultWeight}
                  onChange={(e) => setDefaultWeight(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Unit" htmlFor="new-exercise-wunit">
                <select
                  id="new-exercise-wunit"
                  className={inputClassName}
                  value={defaultWeightUnit}
                  onChange={(e) => setDefaultWeightUnit(e.target.value)}
                >
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </Field>
            </div>

            <Field label="Default rest (sec)" htmlFor="new-exercise-rest">
              <input
                id="new-exercise-rest"
                className={inputClassName}
                inputMode="numeric"
                value={defaultRest}
                onChange={(e) => setDefaultRest(e.target.value)}
                placeholder="30"
              />
            </Field>

            <Field label="YouTube video URL" htmlFor="new-exercise-video" hint="Optional form video.">
              <input
                id="new-exercise-video"
                className={inputClassName}
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                inputMode="url"
              />
            </Field>
          </div>

          <div className="border-t border-border px-5 py-4">
            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save Exercise"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
