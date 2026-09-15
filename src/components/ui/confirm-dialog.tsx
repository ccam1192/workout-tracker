import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-3xl border border-border bg-bg-elevated p-5 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-xl font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-muted">{description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            variant={danger ? "dangerSolid" : "primary"}
            className="w-full"
            size="lg"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
