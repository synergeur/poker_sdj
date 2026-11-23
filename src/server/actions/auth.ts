"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { accountEmail } from "@/lib/auth/account-email";
import { createClient } from "@/lib/supabase/server";
import { publicSupabaseEnv } from "@/lib/supabase/env";
import { parseSignIn, type FormError } from "@/lib/validation/organization";
import { lookupSessionHome } from "@/server/authorization/session-home";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const home = user ? await lookupSessionHome(supabase, user.id) : { kind: "none" as const };

  if (home.kind === "organization") {
    const store = await cookies();
    redirect(organizationHandoffUrl(home.slug, store.getAll()));
  }

  redirect("/admin");
}
