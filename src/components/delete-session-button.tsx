"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase is not configured.");

      const { error: deleteError } = await supabase
        .from("workout_sessions")
        .delete()
        .eq("id", sessionId);

      if (deleteError) throw deleteError;

      router.push("/history");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(getUserFacingError(err, "Could not delete this workout."));
    }
  }

  return (
    <>
      {error ? <Alert>{error}</Alert> : null}
      <Button
        variant="danger"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        Delete Workout
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this workout?"
        description="Deleting this workout will permanently remove it from your workout history. Your workout template will not be affected."
        confirmLabel="Delete Workout"
        danger
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
