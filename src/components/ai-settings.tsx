"use client";

import { useState } from "react";
import { Check, Key, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClassName } from "@/components/ui/field";
import type { AiKeyStatus } from "@/lib/types";

type Props = {
  initialStatus: AiKeyStatus;
};

export function AiSettings({ initialStatus }: Props) {
  const [status, setStatus] = useState<AiKeyStatus>(initialStatus);
  const [keyInput, setKeyInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function handleSave() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/ai/keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save key.");

      setStatus({ hasKey: true, keyHint: data.keyHint });
      setKeyInput("");
      setEditing(false);
      setSuccess("API key saved. AI features are now enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the key.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/ai/keys", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove key.");

      setStatus({ hasKey: false, keyHint: null });
      setConfirmRemove(false);
      setSuccess("API key removed. AI features are now disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">AI Settings</h2>

      <div className="mt-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            status.hasKey ? "bg-accent-soft text-accent" : "bg-surface text-muted"
          }`}
        >
          <Key className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            {status.hasKey ? "AI features enabled" : "AI features disabled"}
          </p>
          {status.hasKey && status.keyHint ? (
            <p className="text-xs text-muted font-mono">{status.keyHint}</p>
          ) : (
            <p className="text-xs text-muted">Add an OpenAI API key to enable AI workout creation.</p>
          )}
        </div>
      </div>

      {error ? <Alert className="mt-3">{error}</Alert> : null}
      {success ? <Alert variant="success" className="mt-3">{success}</Alert> : null}

      {!status.hasKey || editing ? (
        <div className="mt-4 space-y-3">
          <Field label="OpenAI API Key" htmlFor="ai-key">
            <input
              id="ai-key"
              type="password"
              className={inputClassName}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </Field>
          <p className="text-xs text-muted">
            Your key is encrypted and stored server-side. It is never sent to the browser after saving.
            You are responsible for any OpenAI usage and charges.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => void handleSave()} disabled={saving || !keyInput.trim()}>
              <Check className="h-4 w-4" />
              {saving ? "Saving…" : "Save Key"}
            </Button>
            {editing ? (
              <Button variant="ghost" onClick={() => { setEditing(false); setKeyInput(""); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Update Key
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmRemove(true)}>
            <Trash2 className="h-4 w-4" />
            Remove Key
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        title="Remove OpenAI API key?"
        description="AI workout generation will be disabled until you add a new key."
        confirmLabel="Remove Key"
        danger
        busy={saving}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void handleRemove()}
      />
    </section>
  );
}
