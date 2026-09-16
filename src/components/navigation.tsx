"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Clock3, Dumbbell, LayoutGrid, Settings, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/exercises", label: "Exercises", icon: BookOpen },
  { href: "/history", label: "History", icon: Clock3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-elevated/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-bg-elevated px-4 py-6 md:flex md:flex-col">
      <Link href="/dashboard" className="px-3 text-lg font-semibold tracking-tight">
        Workout Tracker
      </Link>
      <p className="mt-1 px-3 text-sm text-muted">Simple tracking</p>
      <ul className="mt-8 space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface hover:text-text",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}

        <li className="pt-2">
          <Link
            href="/workouts/ai"
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition",
              isActive(pathname, "/workouts/ai")
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface hover:text-text",
            )}
          >
            <Sparkles className="h-5 w-5" />
            AI Builder
          </Link>
        </li>

        {isAdmin ? (
          <>
            <li className="pt-4">
              <p className="px-3 text-xs font-semibold uppercase tracking-widest text-muted/60">
                Admin
              </p>
            </li>
            <li>
              <Link
                href="/admin/exercises"
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition",
                  isActive(pathname, "/admin/exercises")
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface hover:text-text",
                )}
              >
                <Shield className="h-5 w-5" />
                Global Exercises
              </Link>
            </li>
          </>
        ) : null}
      </ul>
    </aside>
  );
}
