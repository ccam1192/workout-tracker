"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pause, Play } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDuration } from "@/lib/dates";
import { getUserFacingError } from "@/lib/format";
import { formatPace, haversineDistance, isReasonableMovement, isValidGpsPoint } from "@/lib/gps";
import { createClient } from "@/lib/supabase/client";
import type { GpsPoint, WorkoutSession } from "@/lib/types";

type RunTrackerProps = {
  session: WorkoutSession;
};

type GpsStatus = "waiting" | "active" | "denied" | "unavailable" | "lost";

export function RunTracker({ session }: RunTrackerProps) {
  const router = useRouter();
  const [running, setRunning] = useState(true);
  const [paused, setPaused] = useState(false);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [distanceUnit] = useState<"mi" | "km">("mi");
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("waiting");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const lastPointRef = useRef<GpsPoint | null>(null);
  const gpsPointsRef = useRef<GpsPoint[]>([]);
  const distanceRef = useRef(0);

  pausedRef.current = paused;

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      if (!pausedRef.current) {
        setActiveSeconds((s) => s + 1);
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }

    setGpsStatus("waiting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        if (!isValidGpsPoint(latitude, longitude, accuracy)) return;

        setGpsStatus("active");

        const point: GpsPoint = {
          lat: latitude,
          lng: longitude,
          timestamp: Date.now(),
          accuracy: accuracy ?? undefined,
        };

        if (!pausedRef.current) {
          const prev = lastPointRef.current;
          if (prev && isReasonableMovement(prev, point)) {
            const segmentDistance = haversineDistance(prev, point, "mi");
            if (segmentDistance > 0.001) {
              distanceRef.current += segmentDistance;
              setDistance(distanceRef.current);
            }
          }
          lastPointRef.current = point;
          gpsPointsRef.current = [...gpsPointsRef.current, point];
          setGpsPoints(gpsPointsRef.current);
        }
      },
      (gpsError) => {
        if (gpsError.code === 1) {
          setGpsStatus("denied");
        } else if (gpsError.code === 2) {
          setGpsStatus("lost");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      },
    );
  }, []);

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    startTimer();
    startGps();

    return () => {
      stopTimer();
      stopGps();
    };
  }, [startTimer, startGps, stopTimer, stopGps]);

  function handlePause() {
    setPaused(true);
    lastPointRef.current = null;
  }

  function handleResume() {
    setPaused(false);
    lastPointRef.current = null;
  }

  async function finishRun() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setRunning(false);
    stopTimer();
    stopGps();

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const finalGps = gpsPointsRef.current.length > 0
        ? gpsPointsRef.current.map(({ lat, lng, timestamp }) => ({ lat, lng, timestamp }))
        : null;

      const { error: rpcError } = await supabase.rpc("complete_run_session", {
        p_session_id: session.id,
        p_distance: Math.round(distanceRef.current * 100) / 100,
        p_distance_unit: distanceUnit,
        p_active_duration_seconds: activeSeconds,
        p_gps_data: finalGps,
      });

      if (rpcError) throw rpcError;

      router.push(`/workout/${session.id}/complete`);
      router.refresh();
    } catch (err) {
      setSaving(false);
      setRunning(true);
      setError(getUserFacingError(err, "Could not save your run. Please try again."));
    }
  }

  const pace = formatPace(distance, activeSeconds, distanceUnit);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 pb-8 pt-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          {paused ? "Paused" : "Running"}
        </p>

        <p className="mt-6 font-mono text-6xl font-bold tabular-nums tracking-tight">
          {formatDuration(activeSeconds) ?? "0:00"}
        </p>

        <p className="mt-4 text-4xl font-semibold">
          {distance.toFixed(2)}{" "}
          <span className="text-lg text-muted">{distanceUnit}</span>
        </p>

        {pace ? (
          <p className="mt-3 text-lg text-muted">
            Pace: {pace}
          </p>
        ) : null}

        {gpsStatus === "waiting" ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted">
            <MapPin className="h-4 w-4 animate-pulse" />
            Acquiring GPS signal…
          </div>
        ) : null}

        {gpsStatus === "denied" ? (
          <Alert variant="error" className="mt-6 max-w-sm">
            Location permission is required to track your run distance. Please enable it in your browser settings.
          </Alert>
        ) : null}

        {gpsStatus === "unavailable" ? (
          <Alert variant="error" className="mt-6 max-w-sm">
            Location tracking isn&apos;t available on this device or browser.
          </Alert>
        ) : null}

        {gpsStatus === "lost" ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted">
            <MapPin className="h-4 w-4 animate-pulse text-danger" />
            Waiting for GPS signal…
          </div>
        ) : null}

        {error ? <Alert className="mt-6 max-w-sm">{error}</Alert> : null}
      </div>

      <div className="space-y-4">
        {running ? (
          paused ? (
            <Button
              size="lg"
              className="w-full"
              onClick={handleResume}
            >
              <Play className="h-5 w-5" />
              Resume
            </Button>
          ) : (
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={handlePause}
            >
              <Pause className="h-5 w-5" />
              Pause
            </Button>
          )
        ) : null}

        <Button
          size="lg"
          variant={paused ? "primary" : "danger"}
          className="w-full"
          onClick={() => setConfirmFinish(true)}
          disabled={saving}
        >
          {saving ? "Saving…" : "Finish Run"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmFinish}
        title="Finish this run?"
        description={`Distance: ${distance.toFixed(2)} ${distanceUnit} · Time: ${formatDuration(activeSeconds) ?? "0:00"}`}
        confirmLabel="Finish Run"
        cancelLabel="Continue"
        busy={saving}
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          setConfirmFinish(false);
          void finishRun();
        }}
      />
    </div>
  );
}
