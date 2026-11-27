import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { OrganizationShell } from "@/components/organization-shell";
import { ScopeManager } from "@/components/scopes/scope-manager";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { shellNav } from "@/lib/organization/links";
import { isScopeFormError, type ScopeFormError } from "@/lib/scopes/validation";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome } from "@/server/authorization/session-home";
import { loadScopeManager, navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function ScopeManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; tab?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>
      }
    >
      <ScopeManagerScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function ScopeManagerScreen({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; tab?: string }>;
}) {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const t = await getTranslations();

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/scopes"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const access = await navigationAccess(slug);
  const loaded = await loadScopeManager(slug);
  const params = await searchParams;
  const queryError = isScopeFormError(params.error ?? "") ? (params.error as ScopeFormError) : null;
  const frame = (content: ReactNode) => (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={loaded.ok && loaded.data ? loaded.data.organizationName : t("scopes.title")}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      nav={shellNav("scopes", access)}
    >
      {content}
    </OrganizationShell>
  );

  if (!loaded.ok || !loaded.data) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {t(`scopes.errors.${loaded.ok ? "failed" : loaded.error}`)}
        </p>
      </main>,
    );
  }

  if (!loaded.data.allowed) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-rose-300/30 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">{t("scopes.deniedTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{t("scopes.deniedBody")}</p>
        </section>
      </main>,
    );
  }

  const scopeNames = Object.fromEntries(
    loaded.data.scopes.map((scope) => [
      scope,
      scope === "scope_manager"
        ? t("scopes.catalog.scope_manager")
        : scope === "accounts"
          ? t("scopes.catalog.accounts")
          : scope === "employees"
            ? t("scopes.catalog.employees")
            : scope === "badbeat_entry"
              ? t("scopes.catalog.badbeat_entry")
              : scope === "badbeat_stats"
                ? t("scopes.catalog.badbeat_stats")
                : scope === "schedule"
                  ? t("scopes.catalog.schedule")
                : scope === "cashier"
                  ? t("scopes.catalog.cashier")
                  : scope === "promotions"
                    ? t("scopes.catalog.promotions")
                    : scope,
    ]),
  );

  return frame(
    <ScopeManager
      data={loaded.data}
      saved={params.saved === "1"}
      bannerError={queryError ? t(`scopes.errors.${queryError}`) : null}
      initialTab={params.tab === "roles" ? "roles" : "scopes"}
      copy={{
        saved: t("scopes.saved"),
        manageScopes: t("scopes.manageScopes"),
        manageRoles: t("scopes.manageRoles"),
        employees: t("scopes.employees"),
        roles: t("scopes.roles"),
        rolesIntro: t("scopes.rolesIntro"),
        builtInBadge: t("scopes.builtInBadge"),
        scopes: t("scopes.fields.scopes"),
        newRole: t("scopes.newRole"),
        mainAccount: t("scopes.mainAccount"),
        locked: t("scopes.locked"),
        staff: t("scopes.staff"),
        ownerRole: t("scopes.ownerRole"),
        builtIn: t("scopes.builtIn"),
        save: t("scopes.save"),
        saving: t("scopes.saving"),
        create: t("scopes.create"),
        creating: t("scopes.creating"),
        remove: t("scopes.remove"),
        fields: {
          role: t("scopes.fields.role"),
          description: t("scopes.fields.description"),
        },
        errors: {
          invalid: t("scopes.errors.invalid"),
          forbidden: t("scopes.errors.forbidden"),
          unavailable: t("scopes.errors.unavailable"),
          failed: t("scopes.errors.failed"),
          account_invalid: t("scopes.errors.account_invalid"),
          account_taken: t("scopes.errors.account_taken"),
          password_short: t("scopes.errors.password_short"),
          password_mismatch: t("scopes.errors.password_mismatch"),
          role_invalid: t("scopes.errors.role_invalid"),
          role_taken: t("scopes.errors.role_taken"),
          role_in_use: t("scopes.errors.role_in_use"),
          owner_locked: t("scopes.errors.owner_locked"),
          not_found: t("scopes.errors.not_found"),
        },
        scopeNames,
      }}
    />,
  );
}
