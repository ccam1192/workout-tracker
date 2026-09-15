"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/");
      router.refresh();
    } catch (signOutErr) {
      setBusy(false);
      setError(getUserFacingError(signOutErr, "Could not log out. Please try again."));
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Alert>{error}</Alert> : null}
      <Button variant="secondary" size="lg" className="w-full" onClick={() => void logout()} disabled={busy}>
        {busy ? "Logging out…" : "Log out"}
      </Button>
    </div>
  );
}
