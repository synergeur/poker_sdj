import { getLocale, getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { PromotionsBoard } from "@/components/promotions/promotions-board";
import { OrganizationShell } from "@/components/organization-shell";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { shellNav } from "@/lib/organization/links";
import type { PromotionError } from "@/lib/promotions/validation";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome } from "@/server/authorization/session-home";
import { loadPromotions } from "@/server/services/promotions";
import { navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function PromotionsPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>}>
      <PromotionsScreen />
    </Suspense>
  );
}

async function PromotionsScreen() {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const t = await getTranslations();
  const locale = await getLocale();

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/promotions"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const access = await navigationAccess(slug);
  const loaded = await loadPromotions(access.promotions);
  const frame = (content: ReactNode) => (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={loaded.ok ? loaded.organizationName : t("promotions.headline")}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      nav={shellNav("promotions", access)}
    >
      {content}
    </OrganizationShell>
  );

  if (!loaded.ok) {
    const error = loaded.error as PromotionError;
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {t(`promotions.errors.${error}`)}
        </p>
      </main>,
    );
  }

  if (!loaded.allowed) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-rose-300/30 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">{t("promotions.deniedTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{t("promotions.deniedBody")}</p>
        </section>
      </main>,
    );
  }

  return frame(
    <PromotionsBoard
      promotions={loaded.promotions}
      entries={loaded.entries}
      locale={locale}
      copy={{
        headline: t("promotions.headline"),
        subtitle: t("promotions.subtitle"),
        newPromotion: t("promotions.newPromotion"),
        emptyPromos: t("promotions.emptyPromos"),
        empty: t("promotions.empty"),
        createTitle: t("promotions.createTitle"),
        createHint: t("promotions.createHint"),
        name: t("promotions.name"),
        from: t("promotions.from"),
        to: t("promotions.to"),
        kind: t("promotions.kind"),
        instant: t("promotions.instant"),
        cumulative: t("promotions.cumulative"),
        besthand: t("promotions.besthand"),
        instantHint: t("promotions.instantHint"),
        cumulativeHint: t("promotions.cumulativeHint"),
        besthandHint: t("promotions.besthandHint"),
        requirement: t("promotions.requirement"),
        payout: t("promotions.payout"),
        addRequirement: t("promotions.addRequirement"),
        opening: t("promotions.opening"),
        climbsBy: t("promotions.climbsBy"),
        sameEveryDay: t("promotions.sameEveryDay"),
        differentEachDay: t("promotions.differentEachDay"),
        save: t("promotions.save"),
        cancel: t("promotions.cancel"),
        add: t("promotions.add"),
        edit: t("promotions.edit"),
        remove: t("promotions.remove"),
        date: t("promotions.date"),
        time: t("promotions.time"),
        comment: t("promotions.comment"),
        won: t("promotions.won"),
        amount: t("promotions.amount"),
        hour: t("promotions.hour"),
        minute: t("promotions.minute"),
        current: t("promotions.current"),
        totalPaid: t("promotions.totalPaid"),
        hits: t("promotions.hits"),
        lastPayout: t("promotions.lastPayout"),
        lastWon: t("promotions.lastWon"),
        climbed: t("promotions.climbed"),
        todayRequirement: t("promotions.todayRequirement"),
        keyStats: t("promotions.keyStats"),
        settings: t("promotions.settings"),
        trends: t("promotions.trends"),
        highest: t("promotions.highest"),
        average: t("promotions.average"),
        favorite: t("promotions.favorite"),
        loggedDays: t("promotions.loggedDays"),
        lines: t("promotions.lines"),
        ruleBesthand: t("promotions.ruleBesthand"),
        player: t("promotions.player"),
        phone: t("promotions.phone"),
        hand: t("promotions.hand"),
        paidTonight: t("promotions.paidTonight"),
        callTomorrow: t("promotions.callTomorrow"),
        toCall: t("promotions.toCall"),
        paidLater: t("promotions.paidLater"),
        markPaid: t("promotions.markPaid"),
        call: t("promotions.call"),
        nobodyWaiting: t("promotions.nobodyWaiting"),
        dayTaken: t("promotions.dayTaken"),
        lastWinner: t("promotions.lastWinner"),
        prize: t("promotions.prize"),
        status: t("promotions.status"),
        perDay: t("promotions.perDay"),
        closed: t("promotions.closed"),
        none: t("promotions.none"),
        deletePromo: t("promotions.deletePromo"),
        kept: t("promotions.kept"),
        confirmEntryTitle: t("promotions.confirmEntryTitle"),
        confirmEntryBody: t("promotions.confirmEntryBody"),
        confirmPromoTitle: t("promotions.confirmPromoTitle"),
        confirmPromoBody: t("promotions.confirmPromoBody"),
        previous: t("promotions.previous"),
        next: t("promotions.next"),
        promotion: t("promotions.promotion"),
        ruleInstant: t("promotions.ruleInstant"),
        ruleCumulative: t("promotions.ruleCumulative"),
        errors: {
          invalid: t("promotions.errors.invalid"),
          forbidden: t("promotions.errors.forbidden"),
          not_found: t("promotions.errors.not_found"),
          failed: t("promotions.errors.failed"),
          has_log: t("promotions.errors.has_log"),
          taken: t("promotions.errors.taken"),
        },
      }}
    />
  );
}
