import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OrganizationShell } from "@/components/organization-shell";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { devSection, shellNav } from "@/lib/organization/links";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome, organizationBySlug } from "@/server/authorization/session-home";
import { navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function DevPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>}>
      <DevScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function DevScreen({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const params = await searchParams;
  const section = devSection(params.section);

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/dev"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const ownsOrganization = home.kind === "organization" && home.slug === slug;
  if (home.kind === "organization" && !ownsOrganization) {
    redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/dev"));
  }
  if (!ownsOrganization && home.kind !== "host") {
    redirect(buildApexUrl("/sign-in", site).href);
  }

  const organization = await organizationBySlug(slug);
  if (!organization) {
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const t = await getTranslations();
  const access = await navigationAccess(slug);

  return (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={organization.name}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      nav={{ ...shellNav("overview", access), current: section }}
    >
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-rose-300/40 bg-[#141226] p-4">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-rose-300 uppercase">{t("nav.inDevTitle")}</p>
          <h2 className="mt-2 font-display text-lg font-semibold text-rose-200">
            {section ? t(`nav.items.${section}`) : t("nav.inDevTitle")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{t("nav.inDevBody")}</p>
        </section>
      </main>
    </OrganizationShell>
  );
}
