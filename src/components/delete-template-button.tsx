"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/alert";
import { getUserFacingError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
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
        .from("workout_templates")
        .delete()
        .eq("id", templateId);
      if (deleteError) throw deleteError;
      router.push("/workouts");
      router.refresh();
    } catch (deleteErr) {
      setBusy(false);
      setError(getUserFacingError(deleteErr, "Could not delete this workout."));
    }
  }

  return (
    <>
      {error ? <Alert>{error}</Alert> : null}
      <Button variant="danger" className="w-full sm:w-auto" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete this workout?"
        description="This template will be removed. Past workout history will stay intact."
        confirmLabel="Delete Workout"
        danger
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
