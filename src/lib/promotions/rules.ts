export const PROMOTION_SPAN_DAYS = 62;

export type PromotionKind = "instant" | "cumulative" | "besthand";
export type Settle = "tonight" | "call" | "settled";
export type ClimbMode = "steady" | "daily";

export type PromotionRequirement = {
  id: string;
  label: string;
  payout: number | null;
  appliesOn: string | null;
  position: number;
};

export type PromotionRecord = {
  id: string;
  name: string;
  kind: PromotionKind;
  startsOn: string;
  endsOn: string;
  climbMode: ClimbMode | null;
  startAmount: number | null;
  climbAmount: number | null;
  requirements: PromotionRequirement[];
};

export type PromotionEntryInput = {
  id: string;
  promotionId: string;
  date: string;
  time: string;
  requirementId: string | null;
  won: boolean;
  comment: string;
  playerName: string;
  playerPhone: string;
  hand: string;
  settle: Settle | null;
  createdAt: string;
};

export type PricedPromotionEntry = PromotionEntryInput & {
  amount: number;
  requirement: string;
};

export type InstantStats = {
  kind: "instant";
  totalPaid: number;
  hits: number;
  lastPayout: number | null;
};

export type CumulativeStats = {
  kind: "cumulative";
  current: number | null;
  opening: number;
  climb: number;
  totalPaid: number;
  lastWon: number | null;
  lastWonDate: string | null;
  climbedDays: number;
  todayRequirement: string | null;
};

export type BestHandStats = {
  kind: "besthand";
  prize: number;
  toCall: number;
  paidTonight: number;
  paidLater: number;
  totalPaid: number;
  lastPlayer: string | null;
  lastHand: string | null;
  lastDate: string | null;
};

export function monthBounds(today: string) {
  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1));
  const end = new Date(Date.UTC(year ?? 1970, month ?? 1, 0));
  return { start: isoDate(start), end: isoDate(end) };
}

export function eachDay(start: string, end: string) {
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return [];
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < PROMOTION_SPAN_DAYS) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function requirementFor(promotion: PromotionRecord, date: string) {
  if (promotion.kind === "cumulative" && promotion.climbMode === "daily") {
    return promotion.requirements.find((requirement) => requirement.appliesOn === date) ?? null;
  }
  if (promotion.kind === "cumulative") return promotion.requirements[0] ?? null;
  return null;
}

export function cumulativePrize(promotion: PromotionRecord, entries: readonly PromotionEntryInput[], date: string) {
  const opening = promotion.startAmount ?? 0;
  if (promotion.kind !== "cumulative" || date <= promotion.startsOn) return roundMoney(opening);
  const won = wonDates(promotion, entries);
  let prize = opening;
  let cursor = promotion.startsOn;
  const last = date > promotion.endsOn ? promotion.endsOn : addDays(date, -1);
  while (cursor <= last && cursor <= promotion.endsOn) {
    prize = won.has(cursor) ? opening : roundMoney(prize + (promotion.climbAmount ?? 0));
    cursor = addDays(cursor, 1);
  }
  return roundMoney(prize);
}

export function pricePromotion(promotion: PromotionRecord, entries: readonly PromotionEntryInput[]): PricedPromotionEntry[] {
  const mine = entries.filter((entry) => entry.promotionId === promotion.id);
  return mine.map((entry) => {
    if (promotion.kind === "instant" || promotion.kind === "besthand") {
      const requirement = promotion.requirements.find((item) => item.id === entry.requirementId) ?? (promotion.kind === "besthand" ? promotion.requirements[0] : undefined);
      return {
        ...entry,
        amount: roundMoney(requirement?.payout ?? 0),
        requirement: requirement?.label ?? "",
      };
    }
    const requirement = requirementFor(promotion, entry.date);
    return {
      ...entry,
      amount: cumulativePrize(promotion, mine, entry.date),
      requirement: requirement?.label ?? "",
    };
  });
}

export type PromotionPoint = { date: string; amount: number };

export type PromotionInsights = {
  wins: number;
  lines: number;
  loggedDays: number;
  totalPaid: number;
  average: number | null;
  highest: PromotionPoint | null;
  last: PromotionPoint | null;
  favorite: { label: string; count: number } | null;
  trend: PromotionPoint[];
};

export function promotionTrend(
  promotion: PromotionRecord,
  entries: readonly PromotionEntryInput[],
  today: string,
): PromotionPoint[] {
  const end = today < promotion.endsOn ? today : promotion.endsOn;
  if (end < promotion.startsOn) return [];
  const days = eachDay(promotion.startsOn, end);
  if (promotion.kind === "cumulative") {
    return days.map((date) => ({ date, amount: cumulativePrize(promotion, entries, date) }));
  }
  const priced = pricePromotion(promotion, entries);
  let running = 0;
  return days.map((date) => {
    const day = priced.filter((entry) => entry.date === date && (promotion.kind === "instant" || entry.won));
    running = roundMoney(running + day.reduce((sum, entry) => sum + entry.amount, 0));
    return { date, amount: running };
  });
}

export function promotionInsights(
  promotion: PromotionRecord,
  entries: readonly PromotionEntryInput[],
  today: string,
): PromotionInsights {
  const priced = pricePromotion(promotion, entries);
  const trend = promotionTrend(promotion, entries, today);
  const loggedDays = new Set(priced.map((entry) => entry.date)).size;
  if (promotion.kind === "instant") {
    const ordered = orderPromotionEntries(priced);
    const highest = priced.reduce<PricedPromotionEntry | null>(
      (best, entry) => (!best || entry.amount > best.amount ? entry : best),
      null,
    );
    const totalPaid = roundMoney(priced.reduce((sum, entry) => sum + entry.amount, 0));
    const latest = ordered[0];
    return {
      wins: priced.length,
      lines: priced.length,
      loggedDays,
      totalPaid,
      average: priced.length > 0 ? roundMoney(totalPaid / priced.length) : null,
      highest: highest ? { date: highest.date, amount: highest.amount } : null,
      last: latest ? { date: latest.date, amount: latest.amount } : null,
    favorite: favoriteLabel(priced),
    trend,
  };
}

  if (promotion.kind === "besthand") {
    const paid = priced.filter((entry) => entry.won);
    const ordered = orderPromotionEntries(priced);
    const latest = ordered[0];
    const totalPaid = roundMoney(paid.reduce((sum, entry) => sum + entry.amount, 0));
    const highest = paid.reduce<PricedPromotionEntry | null>((best, entry) => (!best || entry.amount > best.amount ? entry : best), null);
    return {
      wins: paid.length,
      lines: priced.length,
      loggedDays,
      totalPaid,
      average: paid.length > 0 ? roundMoney(totalPaid / paid.length) : null,
      highest: highest ? { date: highest.date, amount: highest.amount } : null,
      last: latest ? { date: latest.date, amount: latest.won ? latest.amount : 0 } : null,
      favorite: null,
      trend,
    };
  }

  const wonDays = new Map<string, { amount: number; requirement: string }>();
  for (const entry of orderPromotionEntries(priced)) {
    if (entry.won && !wonDays.has(entry.date)) wonDays.set(entry.date, { amount: entry.amount, requirement: entry.requirement });
  }
  const peak = trend.reduce<PromotionPoint | null>((best, point) => (!best || point.amount > best.amount ? point : best), null);
  const lastDate = [...wonDays.keys()].sort().at(-1) ?? null;
  const totalPaid = roundMoney([...wonDays.values()].reduce((sum, day) => sum + day.amount, 0));
  return {
    wins: wonDays.size,
    lines: priced.length,
    loggedDays,
    totalPaid,
    average: wonDays.size > 0 ? roundMoney(totalPaid / wonDays.size) : null,
    highest: peak && trend.length > 0 ? peak : null,
    last: lastDate ? { date: lastDate, amount: wonDays.get(lastDate)?.amount ?? 0 } : null,
    favorite: favoriteLabel(wonDays.size > 0 ? [...wonDays.values()].map((day) => ({ requirement: day.requirement })) : priced),
    trend,
  };
}

function favoriteLabel(entries: readonly { requirement: string }[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.requirement) continue;
    counts.set(entry.requirement, (counts.get(entry.requirement) ?? 0) + 1);
  }
  let best: { label: string; count: number } | null = null;
  for (const [label, count] of counts) {
    if (!best || count > best.count) best = { label, count };
  }
  return best;
}

export function orderPromotionEntries<T extends Pick<PromotionEntryInput, "date" | "time" | "createdAt">>(entries: readonly T[]) {
  return [...entries].sort(
    (left, right) =>
      right.date.localeCompare(left.date) || right.time.localeCompare(left.time) || right.createdAt.localeCompare(left.createdAt),
  );
}

export function promotionStats(
  promotion: PromotionRecord,
  entries: readonly PromotionEntryInput[],
  today: string,
): InstantStats | CumulativeStats | BestHandStats {
  const priced = pricePromotion(promotion, entries);
  if (promotion.kind === "besthand") {
    const ordered = orderPromotionEntries(priced);
    const latest = ordered[0];
    const paid = priced.filter((entry) => entry.won);
    return {
      kind: "besthand",
      prize: roundMoney(promotion.requirements[0]?.payout ?? 0),
      toCall: priced.filter((entry) => entry.settle === "call").length,
      paidTonight: priced.filter((entry) => entry.settle === "tonight").length,
      paidLater: priced.filter((entry) => entry.settle === "settled").length,
      totalPaid: roundMoney(paid.reduce((sum, entry) => sum + entry.amount, 0)),
      lastPlayer: latest?.playerName || null,
      lastHand: latest?.hand || null,
      lastDate: latest?.date ?? null,
    };
  }
  if (promotion.kind === "instant") {
    const ordered = orderPromotionEntries(priced);
    return {
      kind: "instant",
      totalPaid: roundMoney(priced.reduce((sum, entry) => sum + entry.amount, 0)),
      hits: priced.length,
      lastPayout: ordered[0]?.amount ?? null,
    };
  }

  const inside = today >= promotion.startsOn && today <= promotion.endsOn;
  const won = [...wonDates(promotion, entries)].sort();
  const lastWonDate = won.at(-1) ?? null;
  return {
    kind: "cumulative",
    current: inside ? cumulativePrize(promotion, entries, today) : null,
    opening: roundMoney(promotion.startAmount ?? 0),
    climb: roundMoney(promotion.climbAmount ?? 0),
    totalPaid: roundMoney(won.reduce((sum, date) => sum + cumulativePrize(promotion, entries, date), 0)),
    lastWon: lastWonDate ? cumulativePrize(promotion, entries, lastWonDate) : null,
    lastWonDate,
    climbedDays: climbedDays(promotion, entries, today),
    todayRequirement: inside ? (requirementFor(promotion, today)?.label ?? null) : null,
  };
}

function climbedDays(promotion: PromotionRecord, entries: readonly PromotionEntryInput[], today: string) {
  if (today <= promotion.startsOn) return 0;
  const won = wonDates(promotion, entries);
  let cursor = addDays(today > promotion.endsOn ? addDays(promotion.endsOn, 1) : today, -1);
  let count = 0;
  while (cursor >= promotion.startsOn) {
    if (won.has(cursor)) break;
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function wonDates(promotion: PromotionRecord, entries: readonly PromotionEntryInput[]) {
  return new Set(
    entries
      .filter(
        (entry) =>
          entry.promotionId === promotion.id &&
          entry.won &&
          entry.date >= promotion.startsOn &&
          entry.date <= promotion.endsOn,
      )
      .map((entry) => entry.date),
  );
}

export function callsWaiting(entries: readonly PromotionEntryInput[]) {
  return entries
    .filter((entry) => entry.settle === "call")
    .sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time) || left.createdAt.localeCompare(right.createdAt));
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + days);
  return isoDate(next);
}

function isoDate(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
