"use client";

import { useState } from "react";
import { HistoryItem } from "@/components/history-item";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutSession } from "@/lib/types";

type HistoryListProps = {
  initialSessions: WorkoutSession[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

export function HistoryList({ initialSessions, hasMore: initialHasMore }: HistoryListProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (loading || !hasMore) return;
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("status", "completed")
      .order("workout_date", { ascending: false })
      .order("completed_at", { ascending: false })
      .range(sessions.length, sessions.length + PAGE_SIZE - 1);

    const newSessions = (data as WorkoutSession[] | null) ?? [];
    setSessions((prev) => [...prev, ...newSessions]);
    setHasMore(newSessions.length === PAGE_SIZE);
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <HistoryItem key={session.id} session={session} />
      ))}
      {hasMore ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void loadMore()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load More"}
        </Button>
      ) : null}
    </div>
  );
}
