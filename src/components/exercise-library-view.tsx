"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Search, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ExerciseLibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "All",
  "Calisthenics",
  "Weight Training",
  "Core",
  "Cardio",
  "Other",
] as const;

export function ExerciseLibraryView() {
  const [exercises, setExercises] = useState<ExerciseLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [tab, setTab] = useState<"all" | "system" | "mine">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExerciseLibraryEntry | null>(null);
  const [deleting, setDeleting] = useState<ExerciseLibraryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadExercises = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    setLoading(true);

    const [{ data }, { data: { user } }] = await Promise.all([
      supabase.from("exercise_library").select("*").order("name"),
      supabase.auth.getUser(),
    ]);

    setExercises((data as ExerciseLibraryEntry[]) ?? []);
    setUserId(user?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadExercises();
  }, [loadExercises]);

  const filtered = useMemo(() => {
    let results = exercises;

    if (tab === "system") {
      results = results.filter((e) => e.is_system_exercise);
    } else if (tab === "mine") {
      results = results.filter((e) => !e.is_system_exercise && e.user_id === userId);
    }

    if (category !== "All") {
      results = results.filter((e) => e.category === category);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      results = results.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          (e.primary_muscles && e.primary_muscles.toLowerCase().includes(query)) ||
          (e.equipment && e.equipment.toLowerCase().includes(query)),
      );
    }

    return results;
  }, [exercises, search, category, tab, userId]);

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { error: deleteError } = await supabase
        .from("exercise_library")
        .delete()
        .eq("id", deleting.id);

      if (deleteError) throw deleteError;

      setExercises((prev) => prev.filter((e) => e.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setError(getUserFacingError(err, "Could not delete this exercise."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { error: updateError } = await supabase
        .from("exercise_library")
        .update({
          name: editing.name,
          category: editing.category,
          description: editing.description,
          form_instructions: editing.form_instructions,
          primary_muscles: editing.primary_muscles,
          equipment: editing.equipment,
          default_repetitions: editing.default_repetitions,
          default_duration_seconds: editing.default_duration_seconds,
          video_url: editing.video_url,
        })
        .eq("id", editing.id);

      if (updateError) throw updateError;

      setExercises((prev) =>
        prev.map((ex) => (ex.id === editing.id ? editing : ex)),
      );
      setEditing(null);
    } catch (err) {
      setError(getUserFacingError(err, "Could not update this exercise."));
    } finally {
      setBusy(false);
    }
  }

  const userExerciseCount = exercises.filter((e) => !e.is_system_exercise && e.user_id === userId).length;
  const systemExerciseCount = exercises.filter((e) => e.is_system_exercise).length;

  return (
    <div className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          className={cn(inputClassName, "pl-10")}
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        {([
          ["all", `All (${exercises.length})`],
          ["system", `Built-in (${systemExerciseCount})`],
          ["mine", `My Exercises (${userExerciseCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              tab === key
                ? "bg-accent text-accent-text"
                : "bg-surface text-muted hover:text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              category === cat
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-muted",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border px-5 py-12 text-center text-muted">
          {search.trim() ? "No exercises match your search." : "No exercises found."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((exercise) => {
            const isExpanded = expanded === exercise.id;
            const isOwn = !exercise.is_system_exercise && exercise.user_id === userId;

            return (
              <article key={exercise.id} className="rounded-3xl border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : exercise.id)}
                  className="flex w-full items-start gap-3 p-5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{exercise.name}</h3>
                      {exercise.is_system_exercise ? (
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                          Built-in
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {[exercise.category, exercise.primary_muscles].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-border px-5 pb-5 pt-3">
                    {exercise.equipment ? (
                      <p className="text-sm text-muted">
                        <span className="font-semibold text-text">Equipment:</span> {exercise.equipment}
                      </p>
                    ) : null}
                    {exercise.description ? (
                      <p className="mt-2 text-sm text-muted">{exercise.description}</p>
                    ) : null}
                    {exercise.form_instructions ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        <span className="font-semibold text-text">Form:</span> {exercise.form_instructions}
                      </p>
                    ) : null}
                    {exercise.default_repetitions ? (
                      <p className="mt-2 text-sm text-muted">
                        <span className="font-semibold text-text">Default target:</span>{" "}
                        {exercise.default_repetitions} reps
                      </p>
                    ) : null}
                    {exercise.default_duration_seconds ? (
                      <p className="mt-2 text-sm text-muted">
                        <span className="font-semibold text-text">Default duration:</span>{" "}
                        {exercise.default_duration_seconds}s
                      </p>
                    ) : null}

                    {isOwn ? (
                      <div className="mt-4 flex gap-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditing({ ...exercise })}
                        >
                          <Edit3 className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleting(exercise)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this exercise?"
        description={`"${deleting?.name}" will be removed from your personal library. Workouts already using it will keep their exercise data.`}
        confirmLabel="Delete Exercise"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="flex h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-bg sm:h-auto sm:max-h-[80dvh] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-xl font-semibold">Edit Exercise</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
            <form onSubmit={handleSaveEdit} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-4 px-5 py-4">
                <Field label="Name" htmlFor="edit-name">
                  <input
                    id="edit-name"
                    className={inputClassName}
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Category" htmlFor="edit-category">
                  <select
                    id="edit-category"
                    className={inputClassName}
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Description" htmlFor="edit-desc">
                  <textarea
                    id="edit-desc"
                    className={textareaClassName}
                    value={editing.description ?? ""}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value || null })}
                  />
                </Field>
                <Field label="Form instructions" htmlFor="edit-form">
                  <textarea
                    id="edit-form"
                    className={textareaClassName}
                    value={editing.form_instructions ?? ""}
                    onChange={(e) => setEditing({ ...editing, form_instructions: e.target.value || null })}
                  />
                </Field>
                <Field label="Primary muscles" htmlFor="edit-muscles">
                  <input
                    id="edit-muscles"
                    className={inputClassName}
                    value={editing.primary_muscles ?? ""}
                    onChange={(e) => setEditing({ ...editing, primary_muscles: e.target.value || null })}
                  />
                </Field>
                <Field label="Equipment" htmlFor="edit-equipment">
                  <input
                    id="edit-equipment"
                    className={inputClassName}
                    value={editing.equipment ?? ""}
                    onChange={(e) => setEditing({ ...editing, equipment: e.target.value || null })}
                  />
                </Field>
              </div>
              <div className="border-t border-border px-5 py-4">
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
