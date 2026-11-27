"use server";

import { parsePromotionDraft, parsePromotionEntryDraft, type PromotionError } from "@/lib/promotions/validation";
import type { PromotionEntryInput, PromotionRecord } from "@/lib/promotions/rules";
import {
  addPromotionEntry,
  createPromotion,
  deletePromotion,
  deletePromotionEntry,
  updatePromotionEntry,
} from "@/server/services/promotions";
import { organizationFromRequest } from "@/server/services/scopes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createPromotionAction(input: {
  name: string;
  kind: string;
  startsOn: string;
  endsOn: string;
  climbMode: string;
  startAmount: string;
  climbAmount: string;
  requirements: { label: string; payout: string; appliesOn: string | null }[];
}): Promise<{ ok: true; promotion: PromotionRecord } | { ok: false; error: PromotionError }> {
  const parsed = parsePromotionDraft(input);
  if (!parsed.ok) return parsed;
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return createPromotion({ organizationId: organization.id, ...parsed.data });
}

export async function deletePromotionAction(id: string): Promise<{ ok: true } | { ok: false; error: PromotionError }> {
  if (!UUID.test(id)) return { ok: false, error: "invalid" };
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return deletePromotion({ organizationId: organization.id, id });
}

export async function savePromotionEntryAction(input: {
  id: string | null;
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
}): Promise<{ ok: true; entry: PromotionEntryInput } | { ok: false; error: PromotionError }> {
  const parsed = parsePromotionEntryDraft(input);
  if (!parsed.ok) return parsed;
  if (input.id && !UUID.test(input.id)) return { ok: false, error: "invalid" };
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  if (input.id) return updatePromotionEntry({ organizationId: organization.id, id: input.id, ...parsed.data });
  return addPromotionEntry({ organizationId: organization.id, ...parsed.data });
}

export async function deletePromotionEntryAction(id: string): Promise<{ ok: true } | { ok: false; error: PromotionError }> {
  if (!UUID.test(id)) return { ok: false, error: "invalid" };
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return deletePromotionEntry({ organizationId: organization.id, id });
}
