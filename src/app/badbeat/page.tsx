import { getLocale, getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { BadbeatLog } from "@/components/badbeat/badbeat-log";
import { OrganizationShell } from "@/components/organization-shell";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import type { BadbeatError } from "@/lib/badbeat/validation";
import { shellNav } from "@/lib/organization/links";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome } from "@/server/authorization/session-home";
import { loadBadbeat } from "@/server/services/badbeat";
import { navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function BadbeatPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>}>
      <BadbeatScreen />
    </Suspense>
  );
}

async function BadbeatScreen() {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const t = await getTranslations();
  const locale = await getLocale();

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/badbeat"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const access = await navigationAccess(slug);
  const allowed = access.badbeatEntry || access.badbeatStats;
  const loaded = await loadBadbeat(allowed);
  const frame = (content: ReactNode) => (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={loaded.ok ? loaded.organizationName : t("badbeat.title")}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      nav={shellNav("badbeat", access)}
    >
      {content}
    </OrganizationShell>
  );

  if (!loaded.ok) {
    const error = loaded.error as BadbeatError;
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {t(`badbeat.errors.${error}`)}
        </p>
      </main>,
    );
  }

  if (!loaded.allowed) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-rose-300/30 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">{t("badbeat.deniedTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{t("badbeat.deniedBody")}</p>
        </section>
      </main>,
    );
  }

  return frame(
    <BadbeatLog
      entries={loaded.entries}
      canEnter={access.badbeatEntry}
      canSeeStats={access.badbeatStats}
      locale={locale}
      copy={{
        headline: t("badbeat.headline"),
        subtitle: t("badbeat.subtitle"),
        statsTitle: t("badbeat.statsTitle"),
        trends: t("badbeat.trends"),
        period: t("badbeat.period"),
        thisMonth: t("badbeat.thisMonth"),
        thisWeek: t("badbeat.thisWeek"),
        allTime: t("badbeat.allTime"),
        periodTotal: t("badbeat.periodTotal"),
        periodEntries: t("badbeat.periodEntries"),
        averageCustomers: t("badbeat.averageCustomers"),
        add: t("badbeat.add"),
        edit: t("badbeat.edit"),
        remove: t("badbeat.remove"),
        save: t("badbeat.save"),
        cancel: t("badbeat.cancel"),
        empty: t("badbeat.empty"),
        date: t("badbeat.date"),
        time: t("badbeat.time"),
        customers: t("badbeat.customers"),
        won: t("badbeat.won"),
        rule: t("badbeat.rule"),
        amount: t("badbeat.amount"),
        comment: t("badbeat.comment"),
        hour: t("badbeat.hour"),
        minute: t("badbeat.minute"),
        editTitle: t("badbeat.editTitle"),
        current: t("badbeat.current"),
        dayTotal: t("badbeat.dayTotal"),
        dayEntries: t("badbeat.dayEntries"),
        carryover: t("badbeat.carryover"),
        lastWon: t("badbeat.lastWon"),
        highestDay: t("badbeat.highestDay"),
        medianCustomers: t("badbeat.medianCustomers"),
        busiestDay: t("badbeat.busiestDay"),
        averageDay: t("badbeat.averageDay"),
        wins: t("badbeat.wins"),
        none: t("badbeat.none"),
        errors: {
          invalid: t("badbeat.errors.invalid"),
          forbidden: t("badbeat.errors.forbidden"),
          not_found: t("badbeat.errors.not_found"),
          failed: t("badbeat.errors.failed"),
        },
      }}
    />
  );
}
