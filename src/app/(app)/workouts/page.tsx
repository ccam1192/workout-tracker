import { Dumbbell } from "lucide-react";
import { ConfigError } from "@/components/config-error";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkoutList } from "@/components/workout-list";
import { requireUser } from "@/lib/supabase/require-user";
import type { TemplateCardData } from "@/lib/types";

export const metadata = {
  title: "Workouts",
};

export default async function WorkoutsPage() {
  const { supabase, configured } = await requireUser();
  if (!configured || !supabase) {
    return <ConfigError />;
  }

  const [{ data: templates }, { data: inProgress }] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("*, workout_template_exercises(id)")
      .order("created_at", { ascending: true }),
    supabase
      .from("workout_sessions")
      .select("id, template_id")
      .eq("status", "in_progress"),
  ]);

  const inProgressByTemplate: Record<string, string> = {};
  for (const session of inProgress ?? []) {
    if (session.template_id && !inProgressByTemplate[session.template_id]) {
      inProgressByTemplate[session.template_id] = session.id;
    }
  }

  const cards: TemplateCardData[] = (templates ?? []).map((template) => ({
    ...template,
    exerciseCount: template.workout_template_exercises?.length ?? 0,
  }));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workouts</h1>
          <p className="mt-1 text-muted">Your templates, ready when you are.</p>
        </div>
        <ButtonLink href="/workouts/new">Create Workout</ButtonLink>
      </header>

      {cards.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No workouts yet"
          description="Create your first workout to get started."
          actionHref="/workouts/new"
          actionLabel="Create Workout"
        />
      ) : (
        <WorkoutList templates={cards} inProgressByTemplate={inProgressByTemplate} />
      )}
    </div>
  );
}
