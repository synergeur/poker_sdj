import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { sharedCookieOptions } from "@/lib/supabase/cookies";
import { publicSupabaseEnv } from "@/lib/supabase/env";

export async function createClient() {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error("missing_supabase_env");
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, sharedCookieOptions(options));
          });
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes the session.
        }
      },
    },
  });
}
