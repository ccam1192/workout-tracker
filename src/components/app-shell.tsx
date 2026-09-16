"use client";

import { usePathname } from "next/navigation";
import { BottomNav, SidebarNav } from "@/components/navigation";

type Props = {
  children: React.ReactNode;
  isAdmin?: boolean;
};

export function AppShell({ children, isAdmin = false }: Props) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/workout/");

  if (hideChrome) {
    return <div className="min-h-dvh bg-bg">{children}</div>;
  }

  return (
    <div className="min-h-dvh bg-bg md:flex">
      <SidebarNav isAdmin={isAdmin} />
      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10 md:pt-10">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
