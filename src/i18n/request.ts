import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "./locale";

const messages = { en, fr };

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : negotiateLocale((await headers()).get("accept-language"));

  return {
    locale,
    messages: messages[locale],
  };
});
