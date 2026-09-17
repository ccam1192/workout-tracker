"use client";

import { useState } from "react";
import { Check, ExternalLink, Key, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, inputClassName } from "@/components/ui/field";
import type { AiKeyStatus } from "@/lib/types";

type Props = {
  initialStatus: AiKeyStatus;
};

const OPENAI_API_KEYS_URL = "https://platform.openai.com/api-keys";

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
            status.hasKey ? "bg-accent-soft text-accent" : "bg-bg text-muted"
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
            <p className="text-xs text-muted">Connect your own OpenAI API key to use AI Workout Builder.</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm leading-relaxed text-muted">
        <div>
          <h3 className="font-semibold text-text">Connect your OpenAI API key</h3>
          <p className="mt-1">
            To use AI Workout Builder, connect your own OpenAI API key. Your OpenAI usage is billed
            directly by OpenAI — you are responsible for any charges associated with your key.
            This app does not pay for your AI usage and does not include a shared OpenAI key.
          </p>
        </div>
        <p>
          A ChatGPT subscription is separate from OpenAI API billing. Having ChatGPT Plus does not
          include API credits, and an API key is billed through the OpenAI Platform.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-bg p-4">
        <h3 className="text-sm font-semibold text-text">How to get an OpenAI API key</h3>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Create or sign in to your OpenAI account.</li>
          <li>Open the OpenAI Platform.</li>
          <li>Go to the API keys section.</li>
          <li>Create a new secret API key.</li>
          <li>Copy the key immediately and paste it into the field below.</li>
          <li>Save your key.</li>
          <li>Return to AI Workout Builder and create your workout.</li>
        </ol>
        <a
          href={OPENAI_API_KEYS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-semibold text-text transition hover:bg-surface-hover"
        >
          Open OpenAI API keys
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {error ? <Alert className="mt-4">{error}</Alert> : null}
      {success ? <Alert variant="success" className="mt-4">{success}</Alert> : null}

      {!status.hasKey || editing ? (
        <div className="mt-5 space-y-3">
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
            Your key is encrypted and stored server-side. After it is saved, the app will not show
            the full key — only a short hint. You can replace or remove it at any time. Never share
            your key.
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
        <div className="mt-5 space-y-3">
          <p className="text-xs text-muted">
            You can replace this key or remove it at any time. The full saved key is never shown again.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Update Key
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmRemove(true)}>
              <Trash2 className="h-4 w-4" />
              Remove Key
            </Button>
          </div>
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
