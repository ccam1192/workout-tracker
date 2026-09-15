import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthScreen } from "@/components/auth-screen";
import { ConfigError } from "@/components/config-error";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <AuthScreen title="Log in" subtitle="Welcome back. Let’s get to work.">
      {isSupabaseConfigured() ? (
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      ) : (
        <ConfigError />
      )}
    </AuthScreen>
  );
}
