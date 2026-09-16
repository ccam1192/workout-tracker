import { AiWorkoutBuilder } from "@/components/ai-workout-builder";
import { ConfigError } from "@/components/config-error";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata = {
  title: "AI Workout Builder",
};

export default async function AiWorkoutPage() {
  const { supabase, user, configured } = await requireUser();

  if (!configured || !user || !supabase) {
    return <ConfigError />;
  }

  const { data: keyData } = await supabase
    .from("user_api_keys")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "openai")
    .maybeSingle();

  const hasAiKey = !!keyData;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">AI Workout Builder</h1>
        <p className="mt-1 text-muted">
          Describe what you want to train and let AI build it.
        </p>
      </header>
      <AiWorkoutBuilder hasAiKey={hasAiKey} />
    </div>
  );
}
