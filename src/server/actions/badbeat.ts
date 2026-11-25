"use server";

import { parseBadbeatDraft, type BadbeatError } from "@/lib/badbeat/validation";
import { addBadbeatEntry, deleteBadbeatEntry, updateBadbeatEntry, type BadbeatRow } from "@/server/services/badbeat";
import { organizationFromRequest } from "@/server/services/scopes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveBadbeatEntryAction(input: {
  id: string | null;
  date: string;
  time: string;
  customers: string;
  won: boolean;
  comment: string;
}): Promise<{ ok: true; entry: BadbeatRow } | { ok: false; error: BadbeatError }> {
  const parsed = parseBadbeatDraft(input);
  if (!parsed.ok) return parsed;
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  if (input.id) {
    return updateBadbeatEntry({ organizationId: organization.id, id: input.id, ...parsed.data });
  }
  return addBadbeatEntry({ organizationId: organization.id, ...parsed.data });
}

export async function deleteBadbeatEntryAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: BadbeatError }> {
  if (!UUID.test(id)) return { ok: false, error: "invalid" };
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return deleteBadbeatEntry({ organizationId: organization.id, id });
}
