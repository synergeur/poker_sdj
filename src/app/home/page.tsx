import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OrganizationShell } from "@/components/organization-shell";
import { organizationLinks } from "@/lib/organization/links";

import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { appUrl, rootDomain } from "@/lib/supabase/env";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, parseRequestHost } from "@/lib/tenant/host";
import { currentSessionHome, organizationBySlug } from "@/server/authorization/session-home";
import { navigationAccess } from "@/server/services/scopes";

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
  const hostSlug = parseRequestHost(headerStore.get("host") ?? "", rootDomain());
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (hostSlug.kind === "tenant" ? hostSlug.slug : null);
  const home = await currentSessionHome();
  const domain = rootDomain();
  const origin = appUrl();

  if (!slug) {
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", domain, origin).href);
  }

  const ownsOrganization = home.kind === "organization" && home.slug === slug;
  if (home.kind === "organization" && !ownsOrganization) {
    redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll()));
  }
  if (!ownsOrganization && home.kind !== "host") {
    redirect(buildApexUrl("/sign-in", domain, origin).href);
  }

  const organization = await organizationBySlug(slug);
  if (!organization) {
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", domain, origin).href);
  }

  const t = await getTranslations();
  const access = await navigationAccess(slug);
  const links = organizationLinks({
    home: t("scopes.home"),
    mine: t("employees.mine"),
    employees: t("employees.title"),
    accounts: t("accounts.title"),
    scopes: t("scopes.title"),
    current: "home",
    self: access.self,
    manageEmployees: access.employees,
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
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/20">
          <p className="text-sm text-violet-100/80">{t("home.subtitle")}</p>
        </section>
      </main>
    </OrganizationShell>
  );
}
