export const BADBEAT_PER_CUSTOMER = 2;

export type BadbeatEntryInput = {
  id: string;
  date: string;
  time: string;
  customers: number;
  won: boolean;
  createdAt?: string;
};

export type BadbeatSortKey = "date" | "time" | "customers" | "amount" | "comment";
export type BadbeatSortDirection = "asc" | "desc";

export type PricedBadbeat<T extends BadbeatEntryInput> = T & {
  added: number;
  amount: number;
  wonAmount: number | null;
};

export type BadbeatStats = {
  current: number;
  dayTotal: number;
  dayEntries: number;
  carryover: number;
  lastWon: number | null;
};

export type BadbeatDay = {
  date: string;
  added: number;
  customers: number;
};

export type BadbeatInsights = {
  highestDay: BadbeatDay | null;
  medianCustomers: number | null;
  busiestDay: BadbeatDay | null;
  averageAdded: number | null;
  wins: number;
};

export type BadbeatPeriod = "month" | "week" | "year" | "all";

export type BadbeatTrendPoint = {
  date: string;
  amount: number;
  customers: number;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function shiftDate(value: string, days: number) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function badbeatPeriodRange(period: BadbeatPeriod, today: string, firstDate?: string): { start: string; end: string } {
  if (period === "all") {
    const start = firstDate && firstDate < today ? firstDate : today;
    return { start, end: today };
  }
  const current = utcDate(today);
  if (period === "month") {
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
    const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
    return { start: isoDate(start), end: isoDate(end) };
  }
  if (period === "year") {
    const start = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
    const end = new Date(Date.UTC(current.getUTCFullYear(), 11, 31));
    return { start: isoDate(start), end: isoDate(end) };
  }
  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: isoDate(monday), end: isoDate(sunday) };
}

export function badbeatTrend<T extends BadbeatEntryInput>(
  entries: T[],
  start: string,
  end: string,
  today: string,
): BadbeatTrendPoint[] {
  const last = end < today ? end : today;
  if (!start || start > last) return [];
  const priced = [...priceBadbeat(entries)].sort(byMoment);
  let balance = 0;
  for (const entry of priced) {
    if (entry.date < start) balance = entry.amount;
  }
  const byDate = new Map<string, { amount: number; customers: number }>();
  for (const entry of priced) {
    if (entry.date < start || entry.date > last) continue;
    const day = byDate.get(entry.date) ?? { amount: balance, customers: 0 };
    day.amount = entry.amount;
    day.customers += entry.customers;
    byDate.set(entry.date, day);
  }
  const points: BadbeatTrendPoint[] = [];
  let cursor = start;
  while (cursor <= last && points.length < 400) {
    const day = byDate.get(cursor);
    if (day) balance = day.amount;
    points.push({ date: cursor, amount: balance, customers: day?.customers ?? 0 });
    cursor = shiftDate(cursor, 1);
  }
  return points;
}

function byMoment(left: BadbeatEntryInput, right: BadbeatEntryInput) {
  return `${left.date}T${left.time}T${left.createdAt ?? ""}`.localeCompare(
    `${right.date}T${right.time}T${right.createdAt ?? ""}`,
  );
}

export function orderBadbeat<T extends PricedBadbeat<BadbeatEntryInput & { comment?: string }>>(
  entries: T[],
  key: BadbeatSortKey,
  direction: BadbeatSortDirection,
  locale?: string,
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...entries].sort((left, right) => {
    const primary =
      key === "date"
        ? left.date.localeCompare(right.date)
        : key === "time"
          ? left.time.localeCompare(right.time)
          : key === "customers"
            ? left.customers - right.customers
            : key === "amount"
              ? left.amount - right.amount
              : (left.comment ?? "").localeCompare(right.comment ?? "", locale, { sensitivity: "base" });
    if (primary !== 0) return primary * sign;
    return byMoment(left, right) * sign;
  });
}

export function priceBadbeat<T extends BadbeatEntryInput>(entries: T[]): PricedBadbeat<T>[] {
  const ordered = [...entries].sort(byMoment);
  const priced = new Map<string, { added: number; amount: number; wonAmount: number | null }>();
  let balance = 0;
  for (const entry of ordered) {
    const added = entry.customers * BADBEAT_PER_CUSTOMER;
    if (entry.won) {
      priced.set(entry.id, { added, amount: 0, wonAmount: balance + added });
      balance = 0;
      continue;
    }
    balance += added;
    priced.set(entry.id, { added, amount: balance, wonAmount: null });
  }
  return entries.map((entry) => ({ ...entry, ...(priced.get(entry.id) ?? { added: 0, amount: 0, wonAmount: null }) }));
}

export function badbeatStats<T extends BadbeatEntryInput>(entries: T[], today: string): BadbeatStats {
  const ordered = [...priceBadbeat(entries)].sort(byMoment);
  const throughToday = ordered.filter((entry) => entry.date <= today);
  const beforeToday = throughToday.filter((entry) => entry.date < today);
  const sameDay = throughToday.filter((entry) => entry.date === today);
  const latest = throughToday[throughToday.length - 1];
  const lastWon = [...throughToday].reverse().find((entry) => entry.wonAmount !== null)?.wonAmount ?? null;
  return {
    current: latest?.amount ?? 0,
    dayTotal: sameDay.reduce((sum, entry) => sum + entry.added, 0),
    dayEntries: sameDay.length,
    carryover: beforeToday[beforeToday.length - 1]?.amount ?? 0,
    lastWon,
  };
}

export function badbeatInsights<T extends BadbeatEntryInput>(entries: T[]): BadbeatInsights {
  const ordered = [...priceBadbeat(entries)].sort(byMoment);
  const days = new Map<string, BadbeatDay>();
  for (const entry of ordered) {
    const day = days.get(entry.date) ?? { date: entry.date, added: 0, customers: 0 };
    day.added += entry.added;
    day.customers += entry.customers;
    days.set(entry.date, day);
  }
  const grouped = [...days.values()];
  const highestDay = grouped.reduce<BadbeatDay | null>(
    (best, day) => (best === null || day.added > best.added ? day : best),
    null,
  );
  const busiestDay = grouped.reduce<BadbeatDay | null>(
    (best, day) => (best === null || day.customers > best.customers ? day : best),
    null,
  );
  const added = grouped.reduce((sum, day) => sum + day.added, 0);
  return {
    highestDay,
    medianCustomers: median(ordered.map((entry) => entry.customers)),
    busiestDay,
    averageAdded: grouped.length === 0 ? null : Math.round((added / grouped.length) * 100) / 100,
    wins: ordered.filter((entry) => entry.won).length,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return (left + right) / 2;
}
