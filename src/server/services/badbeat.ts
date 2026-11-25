import "server-only";

import type { BadbeatError } from "@/lib/badbeat/validation";
import { createClient } from "@/lib/supabase/server";
import { organizationFromRequest } from "@/server/services/scopes";

export type BadbeatRow = {
  id: string;
  date: string;
  time: string;
  customers: number;
  won: boolean;
  comment: string;
  createdAt: string;
};

export type BadbeatPageData =
  | { ok: false; error: BadbeatError }
  | { ok: true; allowed: false; organizationName: string }
  | { ok: true; allowed: true; organizationName: string; entries: BadbeatRow[] };

function mapError(error: { code?: string; message?: string } | null): BadbeatError {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (message.includes("not_found") || error?.code === "P0002") return "not_found";
  if (message.includes("invalid") || error?.code === "22023") return "invalid";
  if (message.includes("forbidden") || error?.code === "42501") return "forbidden";
  return "failed";
}

function rowFrom(value: unknown): BadbeatRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const customers = typeof row.customers === "number" ? row.customers : Number(row.customers);
  const time = typeof row.entered_at === "string" ? row.entered_at.slice(0, 5) : "";
  const date = typeof row.entered_on === "string" ? row.entered_on.slice(0, 10) : "";
  if (typeof row.id !== "string" || !date || !time || !Number.isInteger(customers)) return null;
  return {
    id: row.id,
    date,
    time,
    customers,
    won: row.won === true,
    comment: typeof row.comment === "string" ? row.comment : "",
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export async function loadBadbeat(allowed: boolean): Promise<BadbeatPageData> {
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  if (!allowed) return { ok: true, allowed: false, organizationName: organization.name };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("badbeat_entries")
    .select("id, entered_on, entered_at, customers, won, comment, created_at")
    .eq("organization_id", organization.id)
    .order("entered_on", { ascending: false })
    .order("entered_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: mapError(error) };

  const entries = ((data ?? []) as unknown[]).map(rowFrom).filter((entry): entry is BadbeatRow => entry !== null);
  return { ok: true, allowed: true, organizationName: organization.name, entries };
}

async function write(fn: string, args: Record<string, unknown>): Promise<{ ok: true; entry: BadbeatRow } | { ok: false; error: BadbeatError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: mapError(error) };
  const entry = rowFrom(data);
  if (!entry) return { ok: false, error: "failed" };
  return { ok: true, entry };
}

export async function addBadbeatEntry(input: {
  organizationId: string;
  date: string;
  time: string;
  customers: number;
  won: boolean;
  comment: string;
}) {
  return write("add_badbeat_entry", {
    p_organization_id: input.organizationId,
    p_entered_on: input.date,
    p_entered_at: input.time,
    p_customers: input.customers,
    p_won: input.won,
    p_comment: input.comment,
  });
}

export async function updateBadbeatEntry(input: {
  organizationId: string;
  id: string;
  date: string;
  time: string;
  customers: number;
  won: boolean;
  comment: string;
}) {
  return write("update_badbeat_entry", {
    p_organization_id: input.organizationId,
    p_id: input.id,
    p_entered_on: input.date,
    p_entered_at: input.time,
    p_customers: input.customers,
    p_won: input.won,
    p_comment: input.comment,
  });
}

export async function deleteBadbeatEntry(input: {
  organizationId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: BadbeatError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_badbeat_entry", {
    p_organization_id: input.organizationId,
    p_id: input.id,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}
