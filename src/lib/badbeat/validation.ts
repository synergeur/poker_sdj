const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const BADBEAT_ERRORS = ["invalid", "forbidden", "not_found", "failed"] as const;
export type BadbeatError = (typeof BADBEAT_ERRORS)[number];

export type BadbeatDraft = {
  date: string;
  time: string;
  customers: number;
  won: boolean;
  comment: string;
};

export function isBadbeatError(value: string): value is BadbeatError {
  return (BADBEAT_ERRORS as readonly string[]).includes(value);
}

export function parseBadbeatDraft(input: {
  date: string;
  time: string;
  customers: string;
  won: boolean;
  comment: string;
}): { ok: true; data: BadbeatDraft } | { ok: false; error: "invalid" } {
  const date = input.date.trim();
  const time = input.time.trim();
  const comment = input.comment.trim();
  const customers = Number(input.customers.trim());
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: "invalid" };
  if (!TIME.test(time)) return { ok: false, error: "invalid" };
  if (!Number.isInteger(customers) || customers < 0 || customers > 100_000) return { ok: false, error: "invalid" };
  if (comment.length > 500) return { ok: false, error: "invalid" };
  return { ok: true, data: { date, time, customers, won: input.won, comment } };
}
