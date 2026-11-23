import "server-only";

import { getLocale, getTranslations } from "next-intl/server";

import type { EmployeeCopy } from "@/lib/employees/types";

export async function loadEmployeeCopy(): Promise<EmployeeCopy> {
  const t = await getTranslations();
  const locale = await getLocale();
  return {
    locale,
    title: t("employees.title"),
    mine: t("employees.mine"),
    deniedTitle: t("employees.deniedTitle"),
    deniedBody: t("employees.deniedBody"),
    selfDeniedTitle: t("employees.selfDeniedTitle"),
    selfDeniedBody: t("employees.selfDeniedBody"),
    seeAccount: t("employees.seeAccount"),
    saved: t("employees.saved"),
    notProvided: t("employees.notProvided"),
    information: t("employees.information"),
    phone: t("employees.phone"),
    address: t("employees.address"),
    emergency: t("employees.emergency"),
    emergencyName: t("employees.emergencyName"),
    emergencyPhone: t("employees.emergencyPhone"),
    other: t("employees.other"),
    availability: t("employees.availability"),
    week: t("employees.week"),
    weekHint: t("employees.weekHint"),
    exceptions: t("employees.exceptions"),
    exceptionHint: t("employees.exceptionHint"),
    exceptionDate: t("employees.exceptionDate"),
    available: t("employees.available"),
    unavailable: t("employees.unavailable"),
    from: t("employees.from"),
    to: t("employees.to"),
    hour: t("employees.hour"),
    minute: t("employees.minute"),
    addException: t("employees.addException"),
    noExceptions: t("employees.noExceptions"),
    remove: t("employees.remove"),
    evaluations: t("employees.evaluations"),
    comments: t("employees.comments"),
    addEvaluation: t("employees.addEvaluation"),
    addComment: t("employees.addComment"),
    noteBody: t("employees.noteBody"),
    employeeCanSee: t("employees.employeeCanSee"),
    hiddenFromEmployee: t("employees.hiddenFromEmployee"),
    emptyNotes: t("employees.emptyNotes"),
    sharedEmpty: t("employees.sharedEmpty"),
    save: t("employees.save"),
    saving: t("employees.saving"),
    statusActive: t("scopes.status.active"),
    statusDisabled: t("scopes.status.disabled"),
    staff: t("scopes.staff"),
    ownerRole: t("scopes.ownerRole"),
    days: [1, 2, 3, 4, 5, 6, 7].map((day) => t(`employees.days.${day}`)),
    errors: {
      invalid: t("employees.errors.invalid"),
      forbidden: t("employees.errors.forbidden"),
      unavailable: t("employees.errors.unavailable"),
      failed: t("employees.errors.failed"),
      not_found: t("employees.errors.not_found"),
    },
  };
}
