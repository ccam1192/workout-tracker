import { cn } from "@/lib/utils";

type AlertProps = {
  variant?: "error" | "info" | "success";
  children: React.ReactNode;
  className?: string;
};

export function Alert({ variant = "error", children, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-2xl px-4 py-3 text-sm font-medium",
        variant === "error" && "bg-danger-soft text-danger",
        variant === "info" && "bg-accent-soft text-accent",
        variant === "success" && "bg-accent-soft text-accent",
        className,
      )}
    >
      {children}
    </div>
  );
}
