import { Clock3 } from "lucide-react";
import { ConfigError } from "@/components/config-error";
import { EmptyState } from "@/components/ui/empty-state";
import { HistoryList } from "@/components/history-list";
import { requireUser } from "@/lib/supabase/require-user";
import type { WorkoutSession } from "@/lib/types";

const PAGE_SIZE = 20;

export const metadata = {
  title: "History",
};

export default async function HistoryPage() {
  const { supabase, configured } = await requireUser();
  if (!configured || !supabase) {
    return <ConfigError />;
  }

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("status", "completed")
    .order("workout_date", { ascending: false })
    .order("completed_at", { ascending: false })
    .limit(PAGE_SIZE);

  const items = (sessions as WorkoutSession[] | null) ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-muted">A simple record of the work you put in.</p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No history yet"
          description="Your completed workouts will appear here."
          actionHref="/dashboard"
          actionLabel="Go to Dashboard"
        />
      ) : (
        <HistoryList
          initialSessions={items}
          hasMore={items.length === PAGE_SIZE}
        />
      )}
    </div>
  );
}
