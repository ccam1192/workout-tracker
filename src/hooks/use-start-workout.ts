"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getLocalWorkoutDate } from "@/lib/dates";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export function useStartWorkout() {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function startWorkout(templateId: string) {
    if (lock.current) return;
    lock.current = true;
    setStartingId(templateId);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }

      const { data, error: rpcError } = await supabase.rpc("start_workout_session", {
        p_template_id: templateId,
        p_workout_date: getLocalWorkoutDate(),
      });

      if (rpcError || !data) {
        throw rpcError ?? new Error("Failed to start workout");
      }

      router.push(`/workout/${data}`);
      router.refresh();
    } catch (startError) {
      lock.current = false;
      setStartingId(null);
      setError(getUserFacingError(startError, "Could not start this workout. Please try again."));
    }
  }

  return { startWorkout, startingId, error };
}
