import { getLocale, getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { formatWhen } from "@/components/employees/format";
import { OrganizationShell } from "@/components/organization-shell";
import { WeekSchedule } from "@/components/schedule/week-schedule";
import { organizationLinks } from "@/lib/organization/links";

import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome, organizationBySlug } from "@/server/authorization/session-home";
import { loadOwnSharedHighlights, type SharedHighlight } from "@/server/services/employees";
import { navigationAccess } from "@/server/services/scopes";
import { loadOwnShifts } from "@/server/services/schedule";

export const instant = false;

export default function OrganizationHomePage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-violet-200/70">
          Casino Room
        </div>
      }
    >
      <OrganizationHome />
    </Suspense>
  );
}

async function OrganizationHome() {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();

  if (!slug) {
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const ownsOrganization = home.kind === "organization" && home.slug === slug;
  if (home.kind === "organization" && !ownsOrganization) {
    redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site));
  }
  if (!ownsOrganization && home.kind !== "host") {
    redirect(buildApexUrl("/sign-in", site).href);
  }

  const organization = await organizationBySlug(slug);
  if (!organization) {
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const t = await getTranslations();
  const locale = await getLocale();
  const access = await navigationAccess(slug);
  const [mine, highlights] = await Promise.all([loadOwnShifts(), loadOwnSharedHighlights()]);
  const links = organizationLinks({
    home: t("scopes.home"),
    mine: t("employees.mine"),
        employees: t("employees.title"),
        badbeat: t("badbeat.title"),
        schedule: t("schedule.title"),
        accounts: t("accounts.title"),
    scopes: t("scopes.title"),
    current: "home",
        self: access.self,
        manageEmployees: access.employees,
        badbeatEntry: access.badbeatEntry,
        badbeatStats: access.badbeatStats,
        seeSchedule: access.schedule,
        manageAccounts: access.accounts,
    manageScopes: access.scopes,
  });

  return (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={organization.name}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      links={links}
    >
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <div className="grid shrink-0 gap-3 md:grid-cols-2">
          {highlights.ok ? (
            <>
              <SharedHighlightCard
                title={t("home.latestEvaluation")}
                note={highlights.evaluation}
                empty={t("home.notShared")}
                locale={locale}
              />
              <SharedHighlightCard
                title={t("home.latestComment")}
                note={highlights.comment}
                empty={t("home.notShared")}
                locale={locale}
              />
            </>
          ) : (
            <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50 md:col-span-2">
              {t("employees.errors.failed")}
            </p>
          )}
        </div>
        {mine.ok ? (
          <WeekSchedule
            shifts={mine.shifts}
            copy={{
              title: t("home.weekTitle"),
              hint: t("home.weekHint"),
              empty: t("home.empty"),
              previous: t("home.previous"),
              next: t("home.next"),
              today: t("home.today"),
              days: [1, 2, 3, 4, 5, 6, 7].map((day) => t(`employees.days.${day}`)),
              cash: t("schedule.cash"),
              tournament: t("schedule.tournament"),
              cashier: t("schedule.cashier"),
            }}
          />
        ) : (
          <p role="alert" className="m-4 rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
            {t(`schedule.errors.${mine.error}`)}
          </p>
        )}
      </main>
    </OrganizationShell>
  );
}

function SharedHighlightCard({
  title,
  note,
  empty,
  locale,
}: {
  title: string;
  note: SharedHighlight | null;
  empty: string;
  locale: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
      <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
      {note ? (
        <>
          <p className="mt-2 max-h-24 overflow-auto text-sm whitespace-pre-wrap text-violet-50">{note.body}</p>
          <p className="mt-2 text-xs text-violet-100/55">{[note.authorName, formatWhen(note.createdAt, locale)].filter(Boolean).join(" · ")}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-violet-100/55">{empty}</p>
      )}
    </section>
  );
}
