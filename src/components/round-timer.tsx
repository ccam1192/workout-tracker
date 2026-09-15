"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/dates";

type RoundTimerProps = {
  elapsedSeconds: number;
  paused: boolean;
  onTogglePause: () => void;
  label?: string;
};

export function RoundTimer({
  elapsedSeconds,
  paused,
  onTogglePause,
  label = "Round time",
}: RoundTimerProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">
          {formatDuration(elapsedSeconds) ?? "0:00"}
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onTogglePause}
        aria-label={paused ? "Resume timer" : "Pause timer"}
        className="min-h-11 w-11 px-0"
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>
    </div>
  );
}
