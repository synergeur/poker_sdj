"use server";

import { redirect } from "next/navigation";

import { accountEmail } from "@/lib/auth/account-email";
import { createClient } from "@/lib/supabase/server";
import { publicSupabaseEnv } from "@/lib/supabase/env";
import { parseSignIn, type FormError } from "@/lib/validation/organization";

export type SignInState = { error: FormError | null };

export async function signInAction(_state: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = parseSignIn({
    accountId: formData.get("accountId"),
    password: formData.get("password"),
  });

  if (!parsed.ok) {
    return { error: parsed.error };
  }

  if (!publicSupabaseEnv()) {
    return { error: "unavailable" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: accountEmail(parsed.data.accountId),
    password: parsed.data.password,
  });

  if (error) {
    return { error: "credentials" };
  }

  redirect("/admin");
}

export async function signOutAction() {
  if (publicSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/sign-in");
}
