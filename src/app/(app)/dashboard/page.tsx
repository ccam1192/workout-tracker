import { ConfigError } from "@/components/config-error";
import { DashboardView } from "@/components/dashboard-view";
import { requireUser } from "@/lib/supabase/require-user";
import type { TemplateCardData, WorkoutSession } from "@/lib/types";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { supabase, configured } = await requireUser();
  if (!configured || !supabase) {
    return <ConfigError />;
  }

  await supabase.rpc("ensure_starter_workout");

  const [{ data: templates }, { data: inProgress }, { data: recent }] = await Promise.all([
    supabase
      .from("workout_templates")
      .select("*, workout_template_exercises(id)")
      .order("created_at", { ascending: true }),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("status", "completed")
      .order("workout_date", { ascending: false })
      .order("completed_at", { ascending: false })
      .limit(3),
  ]);

  const cards: TemplateCardData[] = (templates ?? []).map((template) => ({
    ...template,
    exerciseCount: template.workout_template_exercises?.length ?? 0,
  }));

  return (
    <DashboardView
      templates={cards}
      inProgress={(inProgress as WorkoutSession | null) ?? null}
      recent={(recent as WorkoutSession[] | null) ?? []}
    />
  );
}
