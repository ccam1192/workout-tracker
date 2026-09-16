import { AiSettings } from "@/components/ai-settings";
import { ConfigError } from "@/components/config-error";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/supabase/require-user";
import type { AiKeyStatus } from "@/lib/types";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const { supabase, user, configured } = await requireUser();
  if (!configured || !user || !supabase) {
    return <ConfigError />;
  }

  let aiKeyStatus: AiKeyStatus = { hasKey: false, keyHint: null };
  const { data: keyRow } = await supabase
    .from("user_api_keys")
    .select("key_hint")
    .eq("user_id", user.id)
    .eq("provider", "openai")
    .maybeSingle();
  if (keyRow) {
    aiKeyStatus = { hasKey: true, keyHint: keyRow.key_hint };
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted">Keep it simple.</p>
      </header>

      <section className="rounded-3xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Account</h2>
        <p className="mt-3 text-lg font-medium break-all">{user.email}</p>
      </section>

      <AiSettings initialStatus={aiKeyStatus} />

      <LogoutButton />
    </div>
  );
}
