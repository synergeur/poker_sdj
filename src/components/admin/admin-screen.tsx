import { getLocale, getTranslations } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { organizationHandoffUrl } from "@/lib/auth/handoff";
import { requestSite } from "@/lib/tenant/host";

import { AdminShell } from "@/components/admin/admin-shell";
import { CreateOrganizationForm } from "@/components/admin/create-organization-form";
import { OrganizationList } from "@/components/admin/organization-list";
import { isLocale } from "@/i18n/locale";
import { isFormError, type FormError } from "@/lib/validation/organization";
import { getAccess } from "@/server/authorization/platform-admin";
import { currentSessionHome } from "@/server/authorization/session-home";
import { listOrganizations } from "@/server/services/organizations";

export async function AdminScreen({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; updated?: string; statusError?: string }>;
}) {
  const access = await getAccess();
  if (access.kind === "anonymous") {
    redirect("/sign-in");
  }
  if (access.kind === "forbidden") {
    const home = await currentSessionHome();
    if (home.kind === "organization") {
      const headerStore = await headers();
      redirect(
        organizationHandoffUrl(
          home.slug,
          (await cookies()).getAll(),
          requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto")),
        ),
      );
    }
  }

  const localeValue = await getLocale();
  const locale = isLocale(localeValue) ? localeValue : "fr";
  const t = await getTranslations();
  const params = await searchParams;
  const statusError = isFormError(params.statusError ?? "") ? (params.statusError as FormError) : null;

  const shell = {
    locale,
    name: t("brand.name"),
    nav: t("admin.nav"),
    title: t("admin.title"),
    subtitle: t("admin.subtitle"),
    signOut: t("admin.signOut"),
    settings: {
      open: t("settings.open"),
      title: t("settings.title"),
      close: t("settings.close"),
      language: t("settings.language"),
      languageLabel: t("language.label"),
      english: t("language.en"),
      french: t("language.fr"),
      shortcuts: t("settings.shortcuts"),
      sidebarShortcut: t("settings.sidebarShortcut"),
      sidebarKeys: t("settings.sidebarKeys"),
      languageShortcut: t("settings.languageShortcut"),
      languageKeys: t("settings.languageKeys"),
    },
  };

  if (access.kind !== "host") {
    return (
      <AdminShell {...shell}>
        <section className="rounded-2xl border border-rose-300/30 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">{t("admin.deniedTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-violet-100/75">
            {access.kind === "unconfigured" ? t("admin.unconfigured") : t("admin.deniedBody")}
          </p>
        </section>
      </AdminShell>
    );
  }

  const listed = await listOrganizations();

  return (
    <AdminShell {...shell}>
      {params.created === "1" ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-sm text-emerald-50"
        >
          {t("admin.created")}
        </p>
      ) : null}
      {params.updated === "1" ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-sm text-emerald-50"
        >
          {t("admin.updated")}
        </p>
      ) : null}
      {statusError && statusError !== "credentials" ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50"
        >
          {t(`admin.errors.${statusError}`)}
        </p>
      ) : null}
      <CreateOrganizationForm
        copy={{
          title: t("admin.createTitle"),
          fields: {
            name: t("admin.fields.name"),
            slug: t("admin.fields.slug"),
            status: t("admin.fields.status"),
            contactEmail: t("admin.fields.contactEmail"),
            address: t("admin.fields.address"),
            adminFirstName: t("admin.fields.adminFirstName"),
            adminLastName: t("admin.fields.adminLastName"),
            adminAccountId: t("admin.fields.adminAccountId"),
            adminPassword: t("admin.fields.adminPassword"),
            adminPasswordConfirm: t("admin.fields.adminPasswordConfirm"),
          },
          statusActive: t("admin.status.active"),
          statusSuspended: t("admin.status.suspended"),
          hints: {
            slug: t("admin.hints.slug"),
            account: t("admin.hints.account"),
          },
          submit: t("admin.submit"),
          submitting: t("admin.submitting"),
          errors: {
            invalid: t("admin.errors.invalid"),
            slug_invalid: t("admin.errors.slug_invalid"),
            slug_reserved: t("admin.errors.slug_reserved"),
            slug_taken: t("admin.errors.slug_taken"),
            account_invalid: t("admin.errors.account_invalid"),
            account_taken: t("admin.errors.account_taken"),
            password_mismatch: t("admin.errors.password_mismatch"),
            password_short: t("admin.errors.password_short"),
            forbidden: t("admin.errors.forbidden"),
            unavailable: t("admin.errors.unavailable"),
            failed: t("admin.errors.failed"),
            account_cleanup_failed: t("admin.errors.account_cleanup_failed"),
          },
        }}
      />
      {listed.ok ? (
        <OrganizationList
          organizations={listed.organizations}
          locale={locale}
          copy={{
            columns: {
              name: t("admin.columns.name"),
              slug: t("admin.columns.slug"),
              status: t("admin.columns.status"),
              contact: t("admin.columns.contact"),
              admin: t("admin.columns.admin"),
              created: t("admin.columns.created"),
            },
            status: {
              active: t("admin.status.active"),
              suspended: t("admin.status.suspended"),
            },
            suspend: t("admin.suspend"),
            reactivate: t("admin.reactivate"),
            working: t("admin.working"),
            empty: t("admin.empty"),
            edit: t("admin.edit"),
            editor: {
              title: t("admin.editTitle"),
              close: t("admin.editClose"),
              establishment: t("admin.establishment"),
              administrator: t("admin.administrator"),
              fields: {
                name: t("admin.fields.name"),
                slug: t("admin.fields.slug"),
                contactEmail: t("admin.fields.contactEmail"),
                address: t("admin.fields.address"),
                adminFirstName: t("admin.fields.adminFirstName"),
                adminLastName: t("admin.fields.adminLastName"),
                adminAccountId: t("admin.fields.adminAccountId"),
                adminPassword: t("admin.fields.newPassword"),
                adminPasswordConfirm: t("admin.fields.newPasswordConfirm"),
              },
              passwordHint: t("admin.passwordHint"),
              submit: t("admin.save"),
              submitting: t("admin.working"),
              errors: {
                invalid: t("admin.errors.invalid"),
                slug_invalid: t("admin.errors.slug_invalid"),
                slug_reserved: t("admin.errors.slug_reserved"),
                slug_taken: t("admin.errors.slug_taken"),
                account_invalid: t("admin.errors.account_invalid"),
                account_taken: t("admin.errors.account_taken"),
                password_mismatch: t("admin.errors.password_mismatch"),
                password_short: t("admin.errors.password_short"),
                forbidden: t("admin.errors.forbidden"),
                unavailable: t("admin.errors.unavailable"),
                failed: t("admin.errors.save_failed"),
              },
            },
          }}
        />
      ) : (
        <p
          role="alert"
          className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50"
        >
          {t(`admin.errors.${listed.error === "credentials" ? "failed" : listed.error}`)}
        </p>
      )}
    </AdminShell>
  );
}
