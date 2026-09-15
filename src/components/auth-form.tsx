"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Field, inputClassName } from "@/components/ui/field";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured, SUPABASE_CONFIG_MESSAGE } from "@/lib/supabase/env";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!isSupabaseConfigured()) {
      setError(SUPABASE_CONFIG_MESSAGE);
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(SUPABASE_CONFIG_MESSAGE);
      return;
    }

    setSubmitting(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push(nextPath);
        router.refresh();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setInfo("Check your email to confirm your account, then log in.");
      setSubmitting(false);
    } catch (authError) {
      setSubmitting(false);
      setError(
        getUserFacingError(
          authError,
          mode === "login"
            ? "Could not log in. Please try again."
            : "Could not create your account. Please try again.",
        ),
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert>{error}</Alert> : null}
      {info ? <Alert variant="info">{info}</Alert> : null}

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className={inputClassName}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          className={inputClassName}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </Field>

      {mode === "signup" ? (
        <Field label="Confirm password" htmlFor="confirm-password">
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            className={inputClassName}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Field>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting
          ? mode === "login"
            ? "Logging in…"
            : "Creating account…"
          : mode === "login"
            ? "Log In"
            : "Create Account"}
      </Button>

      {mode === "login" ? (
        <p className="text-center text-sm text-muted">
          Need an account?{" "}
          <ButtonLink href="/signup" variant="ghost" size="sm" className="inline min-h-0 px-1">
            Create Account
          </ButtonLink>
        </p>
      ) : (
        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <ButtonLink href="/login" variant="ghost" size="sm" className="inline min-h-0 px-1">
            Log In
          </ButtonLink>
        </p>
      )}
    </form>
  );
}
