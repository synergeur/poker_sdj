import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { EmployeeDirectory } from "@/components/employees/employee-directory";
import { OrganizationShell } from "@/components/organization-shell";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { isEmployeeFormError } from "@/lib/employees/validation";
import { organizationLinks } from "@/lib/organization/links";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome } from "@/server/authorization/session-home";
import { loadEmployeeCopy } from "@/server/services/employee-copy";
import { loadEmployeeDirectory } from "@/server/services/employees";
import { navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; saved?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>}>
      <EmployeesScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeesScreen({
  searchParams,
}: {
  searchParams: Promise<{ employee?: string; saved?: string; error?: string }>;
}) {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const t = await getTranslations();
  const copy = await loadEmployeeCopy();

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/employees"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const access = await navigationAccess(slug);
  const loaded = await loadEmployeeDirectory(access.employees);
  const params = await searchParams;
  const rawError = params.error ?? "";
  const queryError = isEmployeeFormError(rawError) ? rawError : null;
  const frame = (content: ReactNode) => (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={loaded.ok ? loaded.organizationName : copy.title}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      links={organizationLinks({
        home: t("scopes.home"),
        mine: t("employees.mine"),
        employees: t("employees.title"),
        badbeat: t("badbeat.title"),
        schedule: t("schedule.title"),
        accounts: t("accounts.title"),
        scopes: t("scopes.title"),
        current: "employees",
        self: access.self,
        manageEmployees: access.employees,
        badbeatEntry: access.badbeatEntry,
        badbeatStats: access.badbeatStats,
        seeSchedule: access.schedule,
        manageAccounts: access.accounts,
        manageScopes: access.scopes,
      })}
    >
      {content}
    </OrganizationShell>
  );

  if (!loaded.ok) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {copy.errors[loaded.error]}
        </p>
      </main>,
    );
  }

  if (!loaded.allowed) {
    return frame(
      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-rose-300/30 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">{copy.deniedTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{copy.deniedBody}</p>
        </section>
      </main>,
    );
  }

  return frame(
    <EmployeeDirectory
      people={loaded.people}
      selectedId={params.employee ?? null}
      copy={copy}
      canManageAccounts={access.accounts}
      saved={params.saved === "1"}
      bannerError={queryError ? copy.errors[queryError] : null}
    />,
  );
}
