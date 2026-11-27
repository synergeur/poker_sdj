import "server-only";

import type { ClimbMode, PromotionEntryInput, PromotionKind, PromotionRecord, PromotionRequirement, Settle } from "@/lib/promotions/rules";
import type { PromotionError } from "@/lib/promotions/validation";
import { createClient } from "@/lib/supabase/server";
import { organizationFromRequest } from "@/server/services/scopes";

export type PromotionPageData =
  | { ok: false; error: PromotionError }
  | { ok: true; allowed: false; organizationName: string }
  | { ok: true; allowed: true; organizationName: string; promotions: PromotionRecord[]; entries: PromotionEntryInput[] };

function mapError(error: { code?: string; message?: string } | null): PromotionError {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (message.includes("taken")) return "taken";
  if (message.includes("has_log")) return "has_log";
  if (message.includes("not_found") || error?.code === "P0002") return "not_found";
  if (message.includes("invalid") || error?.code === "22023") return "invalid";
  if (message.includes("forbidden") || error?.code === "42501") return "forbidden";
  return "failed";
}

function money(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100) / 100;
}

function dateOf(value: unknown) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function requirementFrom(value: Record<string, unknown>): PromotionRequirement | null {
  const payout = money(value.payout);
  const position = typeof value.position === "number" ? value.position : Number(value.position);
  if (typeof value.id !== "string" || typeof value.label !== "string" || !Number.isInteger(position)) return null;
  return {
    id: value.id,
    label: value.label,
    payout,
    appliesOn: value.applies_on ? dateOf(value.applies_on) : null,
    position,
  };
}

function promotionFrom(value: Record<string, unknown>, requirements: PromotionRequirement[]): PromotionRecord | null {
  const kind = value.kind === "instant" || value.kind === "cumulative" || value.kind === "besthand" ? value.kind : null;
  const climbMode = value.climb_mode === "steady" || value.climb_mode === "daily" ? value.climb_mode : null;
  const startsOn = dateOf(value.starts_on);
  const endsOn = dateOf(value.ends_on);
  if (typeof value.id !== "string" || typeof value.name !== "string" || !kind || !startsOn || !endsOn) return null;
  return {
    id: value.id,
    name: value.name,
    kind: kind as PromotionKind,
    startsOn,
    endsOn,
    climbMode: climbMode as ClimbMode | null,
    startAmount: money(value.start_amount),
    climbAmount: money(value.climb_amount),
    requirements: requirements.sort((left, right) => left.position - right.position),
  };
}

export function entryFrom(value: unknown): PromotionEntryInput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const date = dateOf(row.entered_on);
  const time = typeof row.entered_at === "string" ? row.entered_at.slice(0, 5) : "";
  if (typeof row.id !== "string" || typeof row.promotion_id !== "string" || !date || !time) return null;
  return {
    id: row.id,
    promotionId: row.promotion_id,
    date,
    time,
    requirementId: typeof row.requirement_id === "string" ? row.requirement_id : null,
    won: row.won === true,
    comment: typeof row.comment === "string" ? row.comment : "",
    playerName: typeof row.player_name === "string" ? row.player_name : "",
    playerPhone: typeof row.player_phone === "string" ? row.player_phone : "",
    hand: typeof row.hand === "string" ? row.hand : "",
    settle: row.settle === "tonight" || row.settle === "call" || row.settle === "settled" ? row.settle : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export async function loadPromotions(allowed: boolean): Promise<PromotionPageData> {
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  if (!allowed) return { ok: true, allowed: false, organizationName: organization.name };

  const supabase = await createClient();
  const [promotionRows, requirementRows, entryRows] = await Promise.all([
    supabase
      .from("promotions")
      .select("id, name, kind, starts_on, ends_on, climb_mode, start_amount, climb_amount")
      .eq("organization_id", organization.id)
      .order("starts_on", { ascending: false })
      .order("name"),
    supabase
      .from("promotion_requirements")
      .select("id, promotion_id, label, payout, applies_on, position")
      .eq("organization_id", organization.id)
      .order("position"),
    supabase
      .from("promotion_entries")
      .select("id, promotion_id, requirement_id, entered_on, entered_at, won, comment, player_name, player_phone, hand, settle, created_at")
      .eq("organization_id", organization.id)
      .order("entered_on", { ascending: false })
      .order("entered_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  const failed = promotionRows.error || requirementRows.error || entryRows.error;
  if (failed) return { ok: false, error: mapError(failed) };

  const grouped = new Map<string, PromotionRequirement[]>();
  for (const row of (requirementRows.data ?? []) as Record<string, unknown>[]) {
    const requirement = requirementFrom(row);
    const promotionId = typeof row.promotion_id === "string" ? row.promotion_id : "";
    if (!requirement || !promotionId) continue;
    const list = grouped.get(promotionId) ?? [];
    list.push(requirement);
    grouped.set(promotionId, list);
  }

  const promotions = ((promotionRows.data ?? []) as Record<string, unknown>[])
    .map((row) => promotionFrom(row, grouped.get(typeof row.id === "string" ? row.id : "") ?? []))
    .filter((promotion): promotion is PromotionRecord => promotion !== null);
  const entries = ((entryRows.data ?? []) as unknown[]).map(entryFrom).filter((entry): entry is PromotionEntryInput => entry !== null);
  return { ok: true, allowed: true, organizationName: organization.name, promotions, entries };
}

export async function createPromotion(input: {
  organizationId: string;
  name: string;
  kind: PromotionKind;
  startsOn: string;
  endsOn: string;
  climbMode: ClimbMode | null;
  startAmount: number | null;
  climbAmount: number | null;
  requirements: { label: string; payout: number | null; appliesOn: string | null }[];
}): Promise<{ ok: true; promotion: PromotionRecord } | { ok: false; error: PromotionError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_promotion", {
    p_organization_id: input.organizationId,
    p_name: input.name,
    p_kind: input.kind,
    p_starts_on: input.startsOn,
    p_ends_on: input.endsOn,
    p_climb_mode: input.climbMode,
    p_start_amount: input.startAmount,
    p_climb_amount: input.climbAmount,
    p_requirements: input.requirements.map((requirement) => ({
      label: requirement.label,
      payout: requirement.payout,
      applies_on: requirement.appliesOn,
    })),
  });
  if (error) return { ok: false, error: mapError(error) };
  if (!data || typeof data !== "object") return { ok: false, error: "failed" };
  const payload = data as Record<string, unknown>;
  const requirements = Array.isArray(payload.requirements)
    ? payload.requirements
        .map((item) => (item && typeof item === "object" ? requirementFrom(item as Record<string, unknown>) : null))
        .filter((item): item is PromotionRequirement => item !== null)
    : [];
  const promotion = promotionFrom(payload, requirements);
  if (!promotion) return { ok: false, error: "failed" };
  return { ok: true, promotion };
}

export async function deletePromotion(input: {
  organizationId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: PromotionError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_promotion", {
    p_organization_id: input.organizationId,
    p_id: input.id,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

async function writeEntry(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false as const, error: mapError(error) };
  const entry = entryFrom(data);
  if (!entry) return { ok: false as const, error: "failed" as const };
  return { ok: true as const, entry };
}

export async function addPromotionEntry(input: {
  organizationId: string;
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
}) {
  return writeEntry("add_promotion_entry", {
    p_organization_id: input.organizationId,
    p_promotion_id: input.promotionId,
    p_entered_on: input.date,
    p_entered_at: input.time,
    p_requirement_id: input.requirementId,
    p_won: input.won,
    p_comment: input.comment,
    p_player_name: input.playerName,
    p_player_phone: input.playerPhone,
    p_hand: input.hand,
    p_settle: input.settle,
  });
}

export async function updatePromotionEntry(input: {
  organizationId: string;
  id: string;
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
}) {
  return writeEntry("update_promotion_entry", {
    p_organization_id: input.organizationId,
    p_id: input.id,
    p_promotion_id: input.promotionId,
    p_entered_on: input.date,
    p_entered_at: input.time,
    p_requirement_id: input.requirementId,
    p_won: input.won,
    p_comment: input.comment,
    p_player_name: input.playerName,
    p_player_phone: input.playerPhone,
    p_hand: input.hand,
    p_settle: input.settle,
  });
}

export async function deletePromotionEntry(input: {
  organizationId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: PromotionError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_promotion_entry", {
    p_organization_id: input.organizationId,
    p_id: input.id,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}
