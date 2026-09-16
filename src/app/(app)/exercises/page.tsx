import { ConfigError } from "@/components/config-error";
import { ExerciseLibraryView } from "@/components/exercise-library-view";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata = {
  title: "Exercise Library",
};

export default async function ExercisesPage() {
  const { configured } = await requireUser();
  if (!configured) {
    return <ConfigError />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Exercise Library</h1>
        <p className="mt-1 text-muted">Browse built-in exercises or create your own.</p>
      </header>
      <ExerciseLibraryView />
    </div>
  );
}
