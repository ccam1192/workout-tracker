import { AlertTriangle } from "lucide-react";
import { SUPABASE_CONFIG_MESSAGE } from "@/lib/supabase/env";

export function ConfigError({ message = SUPABASE_CONFIG_MESSAGE }: { message?: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-border bg-surface p-6">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold">Configuration needed</h1>
      <p className="mt-2 text-muted">{message}</p>
    </div>
  );
}
