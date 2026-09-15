import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        redirect("/dashboard");
      }
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
          Daily training
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">Workout Tracker</h1>
        <p className="mt-4 text-xl text-muted">Simple workouts. Simple tracking.</p>
        <p className="mt-4 text-muted">
          Create workout templates, complete your workouts, and keep a history of your
          progress.
        </p>
        <div className="mt-10 flex flex-col gap-3">
          <ButtonLink href="/login" size="lg">
            Log In
          </ButtonLink>
          <ButtonLink href="/signup" variant="secondary" size="lg">
            Create Account
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
