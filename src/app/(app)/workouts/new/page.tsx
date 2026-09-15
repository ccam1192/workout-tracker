import { WorkoutForm } from "@/components/workout-form";
import { ConfigError } from "@/components/config-error";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata = {
  title: "Create workout",
};

export default async function NewWorkoutPage() {
  const { configured } = await requireUser();
  if (!configured) {
    return <ConfigError />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Create Workout</h1>
        <p className="mt-1 text-muted">Build a template you can start any morning.</p>
      </header>
      <WorkoutForm />
    </div>
  );
}
