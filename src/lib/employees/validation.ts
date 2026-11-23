export const EMPLOYEE_FORM_ERRORS = ["invalid", "forbidden", "unavailable", "failed", "not_found"] as const;

export type EmployeeFormError = (typeof EMPLOYEE_FORM_ERRORS)[number];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EmployeeProfileInput = {
  phone: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  other: string;
};

export type WeekdayInput = {
  weekday: number;
  available: boolean;
  startsAt: string;
  endsAt: string;
};

export type EmployeeExceptionInput = {
  workDate: string;
  available: boolean;
  startsAt: string;
  endsAt: string;
};

export type EmployeeNoteInput = {
  userId: string;
  kind: "evaluation" | "comment";
  body: string;
  visible: boolean;
};

export function isEmployeeFormError(value: string): value is EmployeeFormError {
  return (EMPLOYEE_FORM_ERRORS as readonly string[]).includes(value);
}

export function parseEmployeeProfile(input: {
  phone: unknown;
  address: unknown;
  emergencyName: unknown;
  emergencyPhone: unknown;
  other: unknown;
}): { ok: true; data: EmployeeProfileInput } | { ok: false; error: "invalid" } {
  const data = {
    phone: text(input.phone),
    address: text(input.address),
    emergencyName: text(input.emergencyName),
    emergencyPhone: text(input.emergencyPhone),
    other: text(input.other),
  };
  if (
    data.phone.length > 40 ||
    data.address.length > 200 ||
    data.emergencyName.length > 80 ||
    data.emergencyPhone.length > 40 ||
    data.other.length > 2000
  ) {
    return { ok: false, error: "invalid" };
  }
  return { ok: true, data };
}

export function parseEmployeeWeek(input: {
  days: unknown;
}): { ok: true; data: WeekdayInput[] } | { ok: false; error: "invalid" } {
  if (!Array.isArray(input.days) || input.days.length !== 7) return { ok: false, error: "invalid" };
  const days: WeekdayInput[] = [];
  for (const day of input.days) {
    if (!day || typeof day !== "object") return { ok: false, error: "invalid" };
    const record = day as { weekday?: unknown; available?: unknown; startsAt?: unknown; endsAt?: unknown };
    const weekday = Number(record.weekday);
    const available = record.available === true || record.available === "1";
    const startsAt = text(record.startsAt);
    const endsAt = text(record.endsAt);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || days.some((item) => item.weekday === weekday)) {
      return { ok: false, error: "invalid" };
    }
    if (available && (!TIME.test(startsAt) || !TIME.test(endsAt) || startsAt >= endsAt)) {
      return { ok: false, error: "invalid" };
    }
    days.push({
      weekday,
      available,
      startsAt: available ? startsAt : "",
      endsAt: available ? endsAt : "",
    });
  }
  return { ok: true, data: days };
}

export function parseEmployeeException(input: {
  workDate: unknown;
  available: unknown;
  startsAt: unknown;
  endsAt: unknown;
}): { ok: true; data: EmployeeExceptionInput } | { ok: false; error: "invalid" } {
  const workDate = text(input.workDate);
  const available = input.available === true || input.available === "1";
  const startsAt = text(input.startsAt);
  const endsAt = text(input.endsAt);
  if (!isIsoDate(workDate)) return { ok: false, error: "invalid" };
  if (available && (!TIME.test(startsAt) || !TIME.test(endsAt) || startsAt >= endsAt)) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    data: {
      workDate,
      available,
      startsAt: available ? startsAt : "",
      endsAt: available ? endsAt : "",
    },
  };
}

export function parseEmployeeNote(input: {
  userId: unknown;
  kind: unknown;
  body: unknown;
  visible: unknown;
}): { ok: true; data: EmployeeNoteInput } | { ok: false; error: "invalid" } {
  const userId = text(input.userId);
  const body = text(input.body);
  if ((input.kind !== "evaluation" && input.kind !== "comment") || !UUID.test(userId) || body.length < 1 || body.length > 2000) {
    return { ok: false, error: "invalid" };
  }
  return {
    ok: true,
    data: {
      userId,
      kind: input.kind,
      body,
      visible: input.visible === true || input.visible === "1",
    },
  };
}

export function parseEmployeeId(value: unknown): string | null {
  const id = text(value);
  return UUID.test(id) ? id : null;
}

export function employeeReturnPath(input: { page: unknown; userId?: unknown; error?: EmployeeFormError }): string {
  const flag = input.error ? `error=${input.error}` : "saved=1";
  if (input.page === "me") return `/me?${flag}`;
  const userId = typeof input.userId === "string" ? input.userId : "";
  if (input.page === "employees" && UUID.test(userId)) return `/employees?employee=${userId}&${flag}`;
  return `/employees?${flag}`;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
