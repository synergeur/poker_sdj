"use server";

import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE } from "@/i18n/locale";
import { sharedCookieOptions } from "@/lib/supabase/cookies";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(
    LOCALE_COOKIE,
    locale,
    sharedCookieOptions({
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    }),
  );
}
