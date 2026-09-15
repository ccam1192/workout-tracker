import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dangerSolid";
  size?: "md" | "lg" | "sm";
};

const variants = {
  primary:
    "bg-accent text-accent-text hover:brightness-95 active:brightness-90",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-hover",
  ghost: "bg-transparent text-muted hover:text-text hover:bg-surface",
  danger: "bg-danger-soft text-danger hover:bg-danger/20",
  dangerSolid: "bg-danger text-white hover:brightness-110",
};

const sizes = {
  sm: "min-h-10 px-3 text-sm",
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
