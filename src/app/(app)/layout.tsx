import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/supabase/require-user";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await requireUser();

  return <AppShell isAdmin={role === "admin"}>{children}</AppShell>;
}
