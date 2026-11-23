import type { EmployeeCopy, EmployeePerson, EmployeeWeekday } from "@/lib/employees/types";

export function employeeName(person: Pick<EmployeePerson, "firstName" | "lastName" | "accountId">) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.accountId;
}

export function hours(day: Pick<EmployeeWeekday, "available" | "startsAt" | "endsAt">, unavailable: string) {
  if (!day.available || !day.startsAt || !day.endsAt) return unavailable;
  return `${day.startsAt}–${day.endsAt}`;
}

export function formatDay(value: string, locale: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function formatWhen(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function shown(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}

export const fieldClass =
  "w-full rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/60";
