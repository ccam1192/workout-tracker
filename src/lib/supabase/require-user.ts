import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { UserRole } from "@/lib/types";

type RequireUserResult =
  | { supabase: null; user: null; configured: false; role: "user" }
  | {
      supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
      user: NonNullable<Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof createClient>>>["auth"]["getUser"]>>["data"]["user"]>;
      configured: true;
      role: UserRole;
    };

export async function requireUser(): Promise<RequireUserResult> {
  if (!isSupabaseConfigured()) {
    return { supabase: null, user: null, configured: false as const, role: "user" };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { supabase: null, user: null, configured: false as const, role: "user" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as UserRole) ?? "user";

  return { supabase, user, configured: true as const, role };
}
