import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg" | "sm";
};

const variants = {
  primary:
    "bg-accent text-accent-text hover:brightness-95 active:brightness-90",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-hover",
  ghost: "bg-transparent text-muted hover:text-text hover:bg-surface",
  danger: "bg-danger-soft text-danger hover:bg-danger/20",
};

const sizes = {
  sm: "min-h-10 px-3 text-sm",
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-5 text-base",
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
