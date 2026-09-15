import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthScreen } from "@/components/auth-screen";
import { ConfigError } from "@/components/config-error";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <AuthScreen title="Create account" subtitle="Start tracking workouts in minutes.">
      {isSupabaseConfigured() ? (
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      ) : (
        <ConfigError />
      )}
    </AuthScreen>
  );
}
