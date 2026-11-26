import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { OrganizationShell } from "@/components/organization-shell";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { shellNav } from "@/lib/organization/links";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome } from "@/server/authorization/session-home";
import { loadSchedule } from "@/server/services/schedule";
import { navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>}>
      <ScheduleScreen />
    </Suspense>
  );
}

async function ScheduleScreen() {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const t = await getTranslations();

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/schedule"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const access = await navigationAccess(slug);
  const loaded = await loadSchedule(access.schedule);
  const frame = (content: ReactNode) => (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={loaded.ok ? loaded.organizationName : t("schedule.title")}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      nav={shellNav("schedule", access)}
    >
      {content}
    </OrganizationShell>
  );

  if (!loaded.ok) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {t(`schedule.errors.${loaded.error}`)}
        </p>
      </main>,
    );
  }

  if (!loaded.allowed) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-rose-300/30 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">{t("schedule.deniedTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{t("schedule.deniedBody")}</p>
        </section>
      </main>,
    );
  }

  return frame(
    <ScheduleGrid
      people={loaded.people}
      shifts={loaded.shifts}
      copy={{
        title: t("schedule.title"),
        subtitle: t("schedule.subtitle"),
        hint: t("schedule.hint"),
        employees: t("schedule.employees"),
        total: t("schedule.total"),
        shiftCount: t("schedule.shiftCount"),
        day: t("schedule.day"),
        week: t("schedule.week"),
        employee: t("schedule.employee"),
        unavailable: t("schedule.unavailable"),
        previous: t("schedule.previous"),
        next: t("schedule.next"),
        expand: t("schedule.expand"),
        date: t("schedule.date"),
        available: t("schedule.available"),
        off: t("schedule.off"),
        exception: t("schedule.exception"),
        cash: t("schedule.cash"),
        tournament: t("schedule.tournament"),
        cashier: t("schedule.cashier"),
        remove: t("schedule.remove"),
        resizeStart: t("schedule.resizeStart"),
        resizeEnd: t("schedule.resizeEnd"),
        empty: t("schedule.empty"),
        errors: {
          forbidden: t("schedule.errors.forbidden"),
          unavailable: t("schedule.errors.unavailable"),
          failed: t("schedule.errors.failed"),
          range: t("schedule.errors.range"),
          overlap: t("schedule.errors.overlap"),
          not_found: t("schedule.errors.notFound"),
          cashier: t("schedule.errors.cashier"),
        },
      }}
    />,
  );
}
