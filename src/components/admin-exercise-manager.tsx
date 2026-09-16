"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Search, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import { EXERCISE_CATEGORIES } from "@/lib/exercise-categories";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { ExerciseLibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const EQUIPMENT_TYPES = [
  { value: "bodyweight", label: "Bodyweight" },
  { value: "barbell", label: "Barbell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "machine", label: "Machine" },
  { value: "cable", label: "Cable" },
  { value: "other", label: "Other" },
] as const;

const emptyForm = {
  name: "", category: "Calisthenics", description: "", form_instructions: "",
  primary_muscles: "", equipment: "", exercise_type: "bodyweight",
  default_repetitions: "", default_duration_seconds: "", video_url: "",
};

export function AdminExerciseManager() {
  const [exercises, setExercises] = useState<ExerciseLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<ExerciseLibraryEntry | null>(null);
  const [editing, setEditing] = useState<(typeof emptyForm & { id?: string }) | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("exercise_library")
      .select("*")
      .eq("is_system_exercise", true)
      .order("name");
    setExercises((data as ExerciseLibraryEntry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) ||
        (e.primary_muscles ?? "").toLowerCase().includes(q) ||
        (e.category ?? "").toLowerCase().includes(q),
    );
  }, [exercises, search]);

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Not configured.");
      const { error: e } = await supabase.from("exercise_library").delete().eq("id", deleting.id);
      if (e) throw e;
      setExercises((prev) => prev.filter((ex) => ex.id !== deleting.id));
      setDeleting(null);
    } catch (err) {
      setError(getUserFacingError(err, "Could not delete exercise."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Not configured.");

      const payload = {
        name: editing.name.trim(),
        category: editing.category,
        description: editing.description.trim() || null,
        form_instructions: editing.form_instructions.trim() || null,
        primary_muscles: editing.primary_muscles.trim() || null,
        equipment: editing.equipment.trim() || null,
        exercise_type: editing.exercise_type,
        default_repetitions: editing.default_repetitions.trim() || null,
        default_duration_seconds: editing.default_duration_seconds.trim()
          ? Number.parseInt(editing.default_duration_seconds, 10)
          : null,
        video_url: editing.video_url.trim() || null,
      };

      if (editing.id) {
        const { error: err } = await supabase
          .from("exercise_library")
          .update(payload)
          .eq("id", editing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("exercise_library")
          .insert({ ...payload, is_system_exercise: true, user_id: null });
        if (err) throw err;
      }

      setEditing(null);
      void load();
    } catch (err) {
      setError(getUserFacingError(err, "Could not save exercise."));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(ex: ExerciseLibraryEntry) {
    setEditing({
      id: ex.id,
      name: ex.name,
      category: ex.category,
      description: ex.description ?? "",
      form_instructions: ex.form_instructions ?? "",
      primary_muscles: ex.primary_muscles ?? "",
      equipment: ex.equipment ?? "",
      exercise_type: ex.exercise_type,
      default_repetitions: ex.default_repetitions ?? "",
      default_duration_seconds: ex.default_duration_seconds?.toString() ?? "",
      video_url: ex.video_url ?? "",
    });
  }

  return (
    <div className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            className={cn(inputClassName, "pl-10")}
            placeholder="Search global exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setEditing({ ...emptyForm })}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <p className="text-sm text-muted">{exercises.length} global exercises</p>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => (
            <div key={ex.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="min-w-0">
                <p className="font-semibold">{ex.name}</p>
                <p className="text-xs text-muted">
                  {[ex.category, ex.primary_muscles, ex.equipment].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(ex)} className="min-h-10 w-10 px-0">
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleting(ex)} className="min-h-10 w-10 px-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete global exercise?"
        description={`"${deleting?.name}" will be removed for all users. Workouts already using it keep their data.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-bg sm:h-auto sm:max-h-[80dvh] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-xl font-semibold">
                {editing.id ? "Edit Global Exercise" : "New Global Exercise"}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
            <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex-1 space-y-4 px-5 py-4">
                <Field label="Name" htmlFor="adm-name">
                  <input id="adm-name" className={inputClassName} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
                </Field>
                <Field label="Category" htmlFor="adm-cat">
                  <select id="adm-cat" className={inputClassName} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                    {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Equipment type" htmlFor="adm-type">
                  <select id="adm-type" className={inputClassName} value={editing.exercise_type} onChange={(e) => setEditing({ ...editing, exercise_type: e.target.value })}>
                    {EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Description" htmlFor="adm-desc">
                  <textarea id="adm-desc" className={textareaClassName} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </Field>
                <Field label="Form instructions" htmlFor="adm-form">
                  <textarea id="adm-form" className={textareaClassName} value={editing.form_instructions} onChange={(e) => setEditing({ ...editing, form_instructions: e.target.value })} />
                </Field>
                <Field label="Primary muscles" htmlFor="adm-muscles">
                  <input id="adm-muscles" className={inputClassName} value={editing.primary_muscles} onChange={(e) => setEditing({ ...editing, primary_muscles: e.target.value })} />
                </Field>
                <Field label="Equipment" htmlFor="adm-equip">
                  <input id="adm-equip" className={inputClassName} value={editing.equipment} onChange={(e) => setEditing({ ...editing, equipment: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Default reps" htmlFor="adm-reps">
                    <input id="adm-reps" className={inputClassName} value={editing.default_repetitions} onChange={(e) => setEditing({ ...editing, default_repetitions: e.target.value })} />
                  </Field>
                  <Field label="Default duration (sec)" htmlFor="adm-dur">
                    <input id="adm-dur" className={inputClassName} inputMode="numeric" value={editing.default_duration_seconds} onChange={(e) => setEditing({ ...editing, default_duration_seconds: e.target.value })} />
                  </Field>
                </div>
              </div>
              <div className="border-t border-border px-5 py-4">
                <Button type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? "Saving…" : editing.id ? "Save Changes" : "Create Exercise"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
