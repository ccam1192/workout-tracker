import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDisplayDate, formatDuration } from "@/lib/dates";
import { statusLabel, workoutTypeLabel } from "@/lib/format";
import type { WorkoutSession } from "@/lib/types";

type HistoryItemProps = {
  session: WorkoutSession;
};

export function HistoryItem({ session }: HistoryItemProps) {
  const duration = formatDuration(session.duration_seconds);

  return (
    <Link
      href={`/history/${session.id}`}
      className="flex items-center justify-between gap-4 rounded-3xl border border-border bg-surface p-5 transition hover:bg-surface-hover"
    >
      <div>
        <p className="text-sm text-muted">{formatDisplayDate(session.workout_date)}</p>
        <h3 className="mt-1 text-lg font-semibold">{session.template_name}</h3>
        <p className="mt-2 text-sm text-muted">
          {session.rounds} {session.rounds === 1 ? "round" : "rounds"}
          {duration ? ` · ${duration}` : ""}
          {` · ${workoutTypeLabel(session.workout_type)}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={
            session.status === "completed"
              ? "rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent"
              : "rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted"
          }
        >
          {statusLabel(session.status)}
        </span>
        <ChevronRight className="h-5 w-5 text-muted" />
      </div>
    </Link>
  );
}
