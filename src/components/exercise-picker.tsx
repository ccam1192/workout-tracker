"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClassName } from "@/components/ui/field";
import { FILTER_CATEGORIES, matchesCategory } from "@/lib/exercise-categories";
import { createClient } from "@/lib/supabase/client";
import type { ExerciseLibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type ExercisePickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseLibraryEntry) => void;
  onCreateNew: () => void;
};

export function ExercisePicker({ open, onClose, onSelect, onCreateNew }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<ExerciseLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");

  const loadExercises = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    setLoading(true);
    const { data } = await supabase
      .from("exercise_library")
      .select("*")
      .order("name", { ascending: true });

    setExercises((data as ExerciseLibraryEntry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      void loadExercises();
      setSearch("");
      setCategory("All");
    }
  }, [open, loadExercises]);

  const filtered = useMemo(() => {
    let results = exercises;

    if (category !== "All") {
      results = results.filter((e) => matchesCategory(e, category));
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
  }, [exercises, search, category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-bg sm:h-[80dvh] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-xl font-semibold">Add Exercise</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 w-11 px-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              className={cn(inputClassName, "pl-10")}
              placeholder="Search exercises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
          {FILTER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                category === cat
                  ? "bg-accent text-accent-text"
                  : "bg-surface text-muted hover:text-text",
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <button
            type="button"
            onClick={onCreateNew}
            className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent-soft/40 p-4 text-left text-sm font-semibold text-accent transition hover:bg-accent-soft"
          >
            <Plus className="h-5 w-5" />
            Create New Exercise
          </button>

          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted">
              {search.trim() ? "No exercises match your search." : "No exercises found."}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => onSelect(exercise)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition hover:bg-surface-hover"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{exercise.name}</h3>
                      {exercise.is_system_exercise ? (
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                          Built-in
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {[exercise.primary_muscles, exercise.equipment]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Plus className="mt-1 h-4 w-4 shrink-0 text-muted" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
