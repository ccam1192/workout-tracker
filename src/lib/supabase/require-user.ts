import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function requireUser() {
  if (!isSupabaseConfigured()) {
    return { supabase: null, user: null, configured: false as const };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { supabase: null, user: null, configured: false as const };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user, configured: true as const };
}
