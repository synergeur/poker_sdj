import type { CookieOptions } from "@supabase/ssr";

export function sharedCookieOptions(options: CookieOptions = {}, domain = ""): CookieOptions {
  if (!domain) return options;
  return { ...options, domain };
}
