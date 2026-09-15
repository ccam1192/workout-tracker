import { notFound, redirect } from "next/navigation";
import { ConfigError } from "@/components/config-error";
import { WorkoutPlayer } from "@/components/workout-player";
import { requireUser } from "@/lib/supabase/require-user";
import type {
  WorkoutSession,
  WorkoutSessionExercise,
  WorkoutSessionRound,
} from "@/lib/types";

export const metadata = {
  title: "Workout",
};

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { supabase, configured } = await requireUser();
  if (!configured || !supabase) {
    return <ConfigError />;
  }

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    notFound();
  }

  if (session.status === "completed") {
    redirect(`/workout/${sessionId}/complete`);
  }

  const [{ data: exercises }, { data: rounds }] = await Promise.all([
    supabase
      .from("workout_session_exercises")
      .select("*")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true })
      .order("exercise_order", { ascending: true })
      .order("set_number", { ascending: true }),
    supabase
      .from("workout_session_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .order("round_number", { ascending: true }),
  ]);

  return (
    <WorkoutPlayer
      session={session as WorkoutSession}
      initialExercises={(exercises as WorkoutSessionExercise[]) ?? []}
      initialRounds={(rounds as WorkoutSessionRound[]) ?? []}
    />
  );
}
