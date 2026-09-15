import { ConfigError } from "@/components/config-error";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const { user, configured } = await requireUser();
  if (!configured || !user) {
    return <ConfigError />;
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

      <LogoutButton />
    </div>
  );
}
