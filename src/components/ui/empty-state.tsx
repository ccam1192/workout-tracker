import type { LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Icon className="h-7 w-7" />
        </div>
      ) : null}
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-muted">{description}</p>
      {actionHref && actionLabel ? (
        <ButtonLink href={actionHref} className="mt-6" size="lg">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}
