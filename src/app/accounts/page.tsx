import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AccountList } from "@/components/accounts/account-list";
import { OrganizationShell } from "@/components/organization-shell";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { shellNav } from "@/lib/organization/links";
import { ACCOUNTS } from "@/lib/scopes/effective";
import { isScopeFormError, type ScopeFormError } from "@/lib/scopes/validation";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome } from "@/server/authorization/session-home";
import { loadScopeManager, navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; user?: string }>;
}) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>}>
      <AccountsScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function AccountsScreen({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; user?: string }>;
}) {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const t = await getTranslations();

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/accounts"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const access = await navigationAccess(slug);
  const loaded = await loadScopeManager(slug, ACCOUNTS);
  const params = await searchParams;
  const queryError = isScopeFormError(params.error ?? "") ? (params.error as ScopeFormError) : null;
  const frame = (content: ReactNode) => (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={loaded.ok && loaded.data ? loaded.data.organizationName : t("accounts.title")}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      nav={shellNav("accounts", access)}
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
          <h2 className="font-display text-lg font-semibold">{t("accounts.deniedTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{t("accounts.deniedBody")}</p>
        </section>
      </main>,
    );
  }

  return frame(
    <AccountList
      data={loaded.data}
      saved={params.saved === "1"}
      highlightUserId={params.user ?? null}
      bannerError={queryError ? t(`scopes.errors.${queryError}`) : null}
      copy={{
        title: t("accounts.title"),
        modalTitle: t("accounts.modalTitle"),
        newAccount: t("accounts.new"),
        close: t("accounts.close"),
        saved: t("scopes.saved"),
        mainAccount: t("scopes.mainAccount"),
        staff: t("scopes.staff"),
        ownerRole: t("scopes.ownerRole"),
        statusActive: t("scopes.status.active"),
        statusDisabled: t("scopes.status.disabled"),
        create: t("scopes.create"),
        creating: t("scopes.creating"),
        fields: {
          firstName: t("scopes.fields.firstName"),
          lastName: t("scopes.fields.lastName"),
          accountId: t("scopes.fields.accountId"),
          password: t("scopes.fields.password"),
          passwordConfirm: t("scopes.fields.passwordConfirm"),
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
      }}
    />,
  );
}
