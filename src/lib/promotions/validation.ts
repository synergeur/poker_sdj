import { eachDay, PROMOTION_SPAN_DAYS, type ClimbMode, type PromotionKind, type Settle } from "@/lib/promotions/rules";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PROMOTION_ERRORS = ["invalid", "forbidden", "not_found", "failed", "has_log", "taken"] as const;
export type PromotionError = (typeof PROMOTION_ERRORS)[number];

export type PromotionDraft = {
  name: string;
  kind: PromotionKind;
  startsOn: string;
  endsOn: string;
  climbMode: ClimbMode | null;
  startAmount: number | null;
  climbAmount: number | null;
  requirements: { label: string; payout: number | null; appliesOn: string | null }[];
};

export type PromotionEntryDraft = {
  promotionId: string;
  date: string;
  time: string;
  requirementId: string;
  won: boolean;
  comment: string;
  playerName: string;
  playerPhone: string;
  hand: string;
  settle: Settle | null;
};

export function parseMoney(value: string) {
  const trimmed = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0 || amount > 999_999.99) return null;
  return Math.round(amount * 100) / 100;
}

export function parsePromotionDraft(input: {
  name: string;
  kind: string;
  startsOn: string;
  endsOn: string;
  climbMode: string;
  startAmount: string;
  climbAmount: string;
  requirements: { label: string; payout: string; appliesOn: string | null }[];
}): { ok: true; data: PromotionDraft } | { ok: false; error: "invalid" } {
  const name = input.name.trim();
  const startsOn = input.startsOn.trim();
  const endsOn = input.endsOn.trim();
  if (name.length < 1 || name.length > 80) return { ok: false, error: "invalid" };
  if (!DATE.test(startsOn) || !DATE.test(endsOn) || endsOn < startsOn) return { ok: false, error: "invalid" };
  const days = eachDay(startsOn, endsOn);
  if (days.length < 1 || days.length > PROMOTION_SPAN_DAYS || days.at(-1) !== endsOn) return { ok: false, error: "invalid" };
  if (input.kind !== "instant" && input.kind !== "cumulative" && input.kind !== "besthand") return { ok: false, error: "invalid" };

  if (input.kind === "besthand") {
    if (input.requirements.length !== 1) return { ok: false, error: "invalid" };
    const label = input.requirements[0]?.label.trim() ?? "";
    const payout = parseMoney(input.requirements[0]?.payout ?? "");
    if (label.length < 1 || label.length > 80 || payout === null) return { ok: false, error: "invalid" };
    return {
      ok: true,
      data: {
        name,
        kind: "besthand",
        startsOn,
        endsOn,
        climbMode: null,
        startAmount: null,
        climbAmount: null,
        requirements: [{ label, payout, appliesOn: null }],
      },
    };
  }

  if (input.kind === "instant") {
    if (input.requirements.length < 1 || input.requirements.length > 20) return { ok: false, error: "invalid" };
    const requirements = [];
    for (const requirement of input.requirements) {
      const label = requirement.label.trim();
      const payout = parseMoney(requirement.payout);
      if (label.length < 1 || label.length > 80 || payout === null) return { ok: false, error: "invalid" };
      requirements.push({ label, payout, appliesOn: null });
    }
    return {
      ok: true,
      data: {
        name,
        kind: "instant",
        startsOn,
        endsOn,
        climbMode: null,
        startAmount: null,
        climbAmount: null,
        requirements,
      },
    };
  }

  if (input.climbMode !== "steady" && input.climbMode !== "daily") return { ok: false, error: "invalid" };
  const startAmount = parseMoney(input.startAmount);
  const climbAmount = parseMoney(input.climbAmount);
  if (startAmount === null || climbAmount === null) return { ok: false, error: "invalid" };

  if (input.climbMode === "steady") {
    const label = input.requirements[0]?.label.trim() ?? "";
    if (input.requirements.length !== 1 || label.length < 1 || label.length > 80) return { ok: false, error: "invalid" };
    return {
      ok: true,
      data: {
        name,
        kind: "cumulative",
        startsOn,
        endsOn,
        climbMode: "steady",
        startAmount,
        climbAmount,
        requirements: [{ label, payout: null, appliesOn: null }],
      },
    };
  }

  if (input.requirements.length !== days.length) return { ok: false, error: "invalid" };
  const requirements = [];
  for (const date of days) {
    const requirement = input.requirements.find((item) => item.appliesOn === date);
    const label = requirement?.label.trim() ?? "";
    if (!requirement || label.length < 1 || label.length > 80) return { ok: false, error: "invalid" };
    requirements.push({ label, payout: null, appliesOn: date });
  }
  return {
    ok: true,
    data: {
      name,
      kind: "cumulative",
      startsOn,
      endsOn,
      climbMode: "daily",
      startAmount,
      climbAmount,
      requirements,
    },
  };
}

export function parsePromotionEntryDraft(input: {
  promotionId: string;
  date: string;
  time: string;
  requirementId: string;
  won: boolean;
  comment: string;
  kind?: string;
  playerName?: string;
  playerPhone?: string;
  hand?: string;
  settle?: string;
}): { ok: true; data: PromotionEntryDraft } | { ok: false; error: "invalid" } {
  const date = input.date.trim();
  const time = input.time.trim();
  const comment = input.comment.trim();
  if (!UUID.test(input.promotionId) || !UUID.test(input.requirementId)) return { ok: false, error: "invalid" };
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: "invalid" };
  if (!TIME.test(time)) return { ok: false, error: "invalid" };
  if (comment.length > 500) return { ok: false, error: "invalid" };

  if (input.kind === "besthand") {
    const playerName = input.playerName?.trim() ?? "";
    const playerPhone = input.playerPhone?.trim() ?? "";
    const hand = input.hand?.trim() ?? "";
    const settle = input.settle === "tonight" || input.settle === "call" || input.settle === "settled" ? input.settle : null;
    if (!settle || playerName.length < 1 || playerName.length > 80 || hand.length < 1 || hand.length > 120) return { ok: false, error: "invalid" };
    if (playerPhone.length > 40 || (settle === "call" && playerPhone.length < 1)) return { ok: false, error: "invalid" };
    return {
      ok: true,
      data: {
        promotionId: input.promotionId,
        date,
        time,
        requirementId: input.requirementId,
        won: settle !== "call",
        comment,
        playerName,
        playerPhone,
        hand,
        settle,
      },
    };
  }

  return {
    ok: true,
    data: {
      promotionId: input.promotionId,
      date,
      time,
      requirementId: input.requirementId,
      won: input.won,
      comment,
      playerName: "",
      playerPhone: "",
      hand: "",
      settle: null,
    },
  };
}
