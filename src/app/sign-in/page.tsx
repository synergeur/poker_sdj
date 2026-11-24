import { getLocale, getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";

import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { requestSite } from "@/lib/tenant/host";
import { isLocale } from "@/i18n/locale";
import { currentSessionHome } from "@/server/authorization/session-home";

export const instant = false;

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-violet-200/70">
          Casino Room
        </div>
      }
    >
      <SignInScreen />
    </Suspense>
  );
}

async function SignInScreen() {
  const home = await currentSessionHome();
  if (home.kind === "host") {
    redirect("/admin");
  }
  if (home.kind === "organization") {
    const headerStore = await headers();
    redirect(
      organizationHandoffUrl(
        home.slug,
        (await cookies()).getAll(),
        requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto")),
      ),
    );
  }

  const localeValue = await getLocale();
  const locale = isLocale(localeValue) ? localeValue : "fr";
  const t = await getTranslations();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <BrandMark name={t("brand.name")} />
          <LanguageSwitcher
            locale={locale}
            label={t("language.label")}
            english={t("language.en")}
            french={t("language.fr")}
            hotkey
          />
        </div>
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/20">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            {t("signIn.title")}
          </h1>
          <p className="mt-2 text-sm text-violet-200/70">{t("signIn.subtitle")}</p>
          <SignInForm
            copy={{
              accountId: t("signIn.accountId"),
              password: t("signIn.password"),
              submit: t("signIn.submit"),
              submitting: t("signIn.submitting"),
              errors: {
                invalid: t("signIn.errors.invalid"),
                account_invalid: t("signIn.errors.account_invalid"),
                credentials: t("signIn.errors.credentials"),
                unavailable: t("signIn.errors.unavailable"),
              },
            }}
          />
        </section>
      </div>
    </main>
  );
}
