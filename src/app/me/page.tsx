import { getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { EmployeeSelf } from "@/components/employees/employee-self";
import { OrganizationShell } from "@/components/organization-shell";
import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { isEmployeeFormError, type EmployeeFormError } from "@/lib/employees/validation";
import { shellNav } from "@/lib/organization/links";
import { buildApexUrl, ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { currentSessionHome } from "@/server/authorization/session-home";
import { loadEmployeeCopy } from "@/server/services/employee-copy";
import { currentEmployeeUserId, loadOwnEmployee } from "@/server/services/employees";
import { navigationAccess } from "@/server/services/scopes";

export const instant = false;

export default function MyInformationPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-sm text-violet-200/70">Casino Room</div>}>
      <MyInformationScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function MyInformationScreen({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const headerStore = await headers();
  const site = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto"));
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (site.host.kind === "tenant" ? site.host.slug : null);
  const home = await currentSessionHome();
  const t = await getTranslations();
  const copy = await loadEmployeeCopy();

  if (!slug) {
    if (home.kind === "organization") {
      redirect(organizationHandoffUrl(home.slug, (await cookies()).getAll(), site, "/me"));
    }
    redirect(home.kind === "host" ? "/admin" : buildApexUrl("/sign-in", site).href);
  }

  const access = await navigationAccess(slug);
  const userId = await currentEmployeeUserId();
  const loaded = userId
    ? await loadOwnEmployee(userId)
    : { ok: false as const, error: "forbidden" as EmployeeFormError };
  const params = await searchParams;
  const rawError = params.error ?? "";
  const queryError = isEmployeeFormError(rawError) ? rawError : null;
  const frame = (content: ReactNode) => (
    <OrganizationShell
      brand={t("brand.name")}
      eyebrow={t("home.eyebrow")}
      title={loaded.ok ? loaded.organizationName : copy.mine}
      signOutHref="/auth/sign-out"
      signOutLabel={t("admin.signOut")}
      nav={shellNav("me", access)}
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
          <h2 className="font-display text-lg font-semibold">{copy.selfDeniedTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">{copy.selfDeniedBody}</p>
        </section>
      </main>,
    );
  }

  return frame(
    <EmployeeSelf person={loaded.person} copy={copy} saved={params.saved === "1"} bannerError={queryError ? copy.errors[queryError] : null} />,
  );
}
