import type { CookieOptions } from "@supabase/ssr";

import { rootDomain } from "@/lib/supabase/env";

export function sharedCookieOptions(options: CookieOptions = {}): CookieOptions {
  const domain = rootDomain().split(":")[0]?.trim().toLowerCase();
  if (!domain) return options;
  return { ...options, domain };
}
