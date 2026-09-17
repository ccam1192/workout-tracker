"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Plus, Send, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { inputClassName } from "@/components/ui/field";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AiMessage, AiProposedExercise, AiWorkoutProposal } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = { hasAiKey: boolean };

const SUGGESTIONS = [
  "Full body, 30 minutes, no equipment",
  "Upper body with dumbbells",
  "Quick 20-minute bodyweight circuit",
  "Legs and core day",
  "Chest and shoulders with barbell",
  "I only have 15 minutes",
];

export function AiWorkoutBuilder({ hasAiKey }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AiWorkoutProposal | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: AiMessage = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "AI request failed.");
      }

      const aiProposal = data.proposal as AiWorkoutProposal;
      setProposal(aiProposal);
      setMessages([...nextMessages, { role: "assistant", content: aiProposal.message }]);

      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      setError(getUserFacingError(err, "AI workout generation failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveWorkout(andStart: boolean) {
    if (!proposal || saving) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Not authenticated");

      const { data: template, error: templateError } = await supabase
        .from("workout_templates")
        .insert({
          user_id: user.id,
          name: proposal.workout.name,
          description: proposal.workout.description || null,
          workout_type: proposal.workout.workout_type,
          rounds: proposal.workout.rounds,
        })
        .select("id")
        .single();

      if (templateError || !template) throw templateError ?? new Error("Failed to create workout");

      const exercisePayload = proposal.workout.exercises.map((ex, i) => ({
        template_id: template.id,
        exercise_order: i + 1,
        name: ex.name,
        sets: ex.sets,
        repetitions: ex.repetitions,
        duration_seconds: ex.duration_seconds,
        weight: ex.weight,
        weight_unit: ex.weight_unit,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
        exercise_library_id: ex.exercise_library_id,
      }));

      const { error: exError } = await supabase
        .from("workout_template_exercises")
        .insert(exercisePayload);

      if (exError) throw exError;

      if (andStart) {
        const { data: sessionId, error: rpcError } = await supabase.rpc("start_workout_session", {
          p_template_id: template.id,
          p_workout_date: new Date().toISOString().slice(0, 10),
        });
        if (rpcError || !sessionId) throw rpcError ?? new Error("Failed to start");
        router.push(`/workout/${sessionId}`);
      } else {
        router.push(`/workouts/${template.id}`);
      }
      router.refresh();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err, "Could not save the workout."));
    }
  }

  async function handleApproveNewExercise(ex: AiProposedExercise) {
    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error: insertErr } = await supabase
      .from("exercise_library")
      .insert({
        user_id: user.id,
        name: ex.name,
        category: ex.category,
        description: ex.description,
        form_instructions: ex.form_instructions,
        primary_muscles: ex.primary_muscles,
        equipment: ex.equipment,
        exercise_type: ex.exercise_type,
        default_repetitions: ex.default_repetitions,
        default_duration_seconds: ex.default_duration_seconds,
        is_system_exercise: false,
      })
      .select("id")
      .single();

    if (insertErr || !data) return;

    if (proposal) {
      const updated = { ...proposal };
      updated.workout.exercises = updated.workout.exercises.map((e) =>
        e.name === ex.name && !e.exercise_library_id
          ? { ...e, exercise_library_id: data.id }
          : e,
      );
      updated.proposed_new_exercises = updated.proposed_new_exercises.filter(
        (p) => p.name !== ex.name,
      );
      setProposal(updated);
    }
  }

  if (!hasAiKey) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">AI Workout Builder</h2>
        <p className="mt-2 max-w-sm text-muted">
          AI Workout Builder needs your own OpenAI API key. OpenAI bills that usage to you —
          this app does not pay for it. Add a key in Settings to get started.
        </p>
        <ButtonLink href="/settings" className="mt-6" size="lg">
          Configure AI
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">What do you want to train?</h2>
          <p className="mt-2 text-muted">
            Tell me your goals, equipment, and how much time you have.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-hover hover:text-text"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "ml-8 bg-accent text-accent-text"
                  : "mr-8 border border-border bg-surface",
              )}
            >
              {msg.role === "assistant" ? (
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-accent">
                  <Bot className="h-3.5 w-3.5" /> AI Trainer
                </div>
              ) : null}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))}
          {loading ? (
            <div className="mr-8 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          ) : null}
        </div>
      )}

      {error ? <Alert>{error}</Alert> : null}

      {proposal && !loading ? (
        <div className="rounded-3xl border border-accent/40 bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Proposed Workout
          </p>
          <h3 className="mt-2 text-xl font-semibold">{proposal.workout.name}</h3>
          {proposal.workout.description ? (
            <p className="mt-1 text-sm text-muted">{proposal.workout.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            {proposal.workout.workout_type === "circuit" ? "Circuit" : "Standard"} ·{" "}
            {proposal.workout.rounds} {proposal.workout.rounds === 1 ? "round" : "rounds"} ·{" "}
            ~{proposal.workout.estimated_duration_minutes} min
          </p>

          <div className="mt-4 space-y-2">
            {proposal.workout.exercises.map((ex, i) => (
              <div key={i} className="rounded-2xl border border-border bg-bg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{ex.name}</p>
                    <p className="text-xs text-muted">
                      {[
                        ex.sets ? `${ex.sets} sets` : null,
                        ex.repetitions ? `${ex.repetitions} reps` : null,
                        ex.duration_seconds ? `${ex.duration_seconds}s` : null,
                        ex.weight ? `${ex.weight} ${ex.weight_unit ?? "lb"}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Complete when ready"}
                    </p>
                  </div>
                  {ex.exercise_library_id ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                      Library
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {proposal.proposed_new_exercises.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                New Exercises Proposed
              </p>
              {proposal.proposed_new_exercises.map((ex, i) => (
                <div key={i} className="rounded-2xl border border-dashed border-accent/50 bg-accent-soft/30 p-3">
                  <p className="font-semibold">{ex.name}</p>
                  <p className="mt-1 text-xs text-muted">{ex.description}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => void handleApproveNewExercise(ex)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add to My Library
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => void handleSaveWorkout(false)}
              disabled={saving}
            >
              {saving ? "Saving…" : "Create Workout"}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={() => void handleSaveWorkout(true)}
              disabled={saving}
            >
              Create & Start
            </Button>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="sticky bottom-24 z-10 flex gap-2 md:bottom-4"
      >
        <input
          className={cn(inputClassName, "flex-1")}
          placeholder={messages.length === 0 ? "Describe your ideal workout…" : "Modify: 'make it shorter', 'add more legs'…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()} className="shrink-0">
          <Send className="h-5 w-5" />
        </Button>
      </form>
      <div ref={scrollRef} />
    </div>
  );
}
