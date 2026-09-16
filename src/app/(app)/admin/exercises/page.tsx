import { redirect } from "next/navigation";
import { AdminExerciseManager } from "@/components/admin-exercise-manager";
import { ConfigError } from "@/components/config-error";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata = {
  title: "Admin — Exercises",
};

export default async function AdminExercisesPage() {
  const { configured, role } = await requireUser();

  if (!configured) {
    return <ConfigError />;
  }

  if (role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Global Exercises</h1>
        <p className="mt-1 text-muted">Manage exercises available to all users.</p>
      </header>
      <AdminExerciseManager />
    </div>
  );
}
