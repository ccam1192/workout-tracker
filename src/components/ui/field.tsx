type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
};

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export const inputClassName =
  "w-full min-h-12 rounded-2xl border border-border bg-bg px-4 text-text outline-none transition placeholder:text-muted/70 focus:border-accent";

export const textareaClassName =
  "w-full min-h-24 rounded-2xl border border-border bg-bg px-4 py-3 text-text outline-none transition placeholder:text-muted/70 focus:border-accent";
