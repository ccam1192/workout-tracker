import { notFound } from "next/navigation";
import { ConfigError } from "@/components/config-error";
import { WorkoutForm } from "@/components/workout-form";
import { requireUser } from "@/lib/supabase/require-user";
import type { WorkoutTemplateWithExercises } from "@/lib/types";

export const metadata = {
  title: "Edit workout",
};

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, configured } = await requireUser();
  if (!configured || !supabase) {
    return <ConfigError />;
  }

  const { data: template } = await supabase
    .from("workout_templates")
    .select("*, workout_template_exercises(*)")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Edit Workout</h1>
        <p className="mt-1 text-muted">Changes apply to future sessions, not past history.</p>
      </header>
      <WorkoutForm template={template as WorkoutTemplateWithExercises} />
    </div>
  );
}
