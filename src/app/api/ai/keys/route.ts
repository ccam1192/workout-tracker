import { NextResponse } from "next/server";
import { encrypt, maskApiKey } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_api_keys")
    .select("key_hint, created_at")
    .eq("user_id", user.id)
    .eq("provider", "openai")
    .maybeSingle();

  return NextResponse.json({
    hasKey: !!data,
    keyHint: data?.key_hint ?? null,
  });
}

export async function PUT(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawKey = body.key?.trim();
  if (!rawKey || !rawKey.startsWith("sk-")) {
    return NextResponse.json({ error: "Invalid OpenAI API key format." }, { status: 400 });
  }

  let encryptedKey: string;
  try {
    encryptedKey = encrypt(rawKey);
  } catch {
    return NextResponse.json(
      { error: "Could not securely store the key. Server encryption is misconfigured." },
      { status: 500 },
    );
  }

  const keyHint = maskApiKey(rawKey);

  const { error: upsertError } = await supabase
    .from("user_api_keys")
    .upsert(
      {
        user_id: user.id,
        provider: "openai",
        encrypted_key: encryptedKey,
        key_hint: keyHint,
      },
      { onConflict: "user_id,provider" },
    );

  if (upsertError) {
    return NextResponse.json({ error: "Could not save the key." }, { status: 500 });
  }

  return NextResponse.json({ hasKey: true, keyHint: keyHint });
}

export async function DELETE() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "openai");

  return NextResponse.json({ hasKey: false, keyHint: null });
}
