import "server-only";

import type { ScheduleEmployee, ScheduleWindow } from "@/lib/schedule/bands";
import type { ScheduleShift, ScheduleWriteError } from "@/lib/schedule/shifts";
import { CASHIER, hasEffectiveScope } from "@/lib/scopes/effective";
import { visibleRoleName } from "@/lib/scopes/labels";
import { createClient } from "@/lib/supabase/server";
import { organizationFromRequest } from "@/server/services/scopes";

export type ScheduleLoadError = "forbidden" | "unavailable" | "failed";

export type ScheduleBoard =
  | { ok: false; error: ScheduleLoadError }
  | { ok: true; allowed: false; organizationName: string }
  | { ok: true; allowed: true; organizationName: string; people: ScheduleEmployee[]; shifts: ScheduleShift[] };

type MemberRow = {
  user_id: string;
  status: string;
  is_owner: boolean;
  profiles: { account_id: string; first_name: string | null; last_name: string | null } | { account_id: string; first_name: string | null; last_name: string | null }[] | null;
  roles:
    | { name: string; role_scopes: { scope_key: string }[] | null }
    | { name: string; role_scopes: { scope_key: string }[] | null }[]
    | null;
};

type WeekRow = { user_id: string; weekday: number; available: boolean; starts_at: string | null; ends_at: string | null };
type ExceptionRow = { user_id: string; work_date: string; available: boolean; starts_at: string | null; ends_at: string | null };

export async function loadSchedule(allowed: boolean): Promise<ScheduleBoard> {
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  if (!allowed) return { ok: true, allowed: false, organizationName: organization.name };
  try {
    const supabase = await createClient();
    const [members, weekdays, exceptions, shifts, extras] = await Promise.all([
      supabase
        .from("organization_members")
        .select("user_id, status, is_owner, profiles(account_id, first_name, last_name), roles(name, role_scopes(scope_key))")
        .eq("organization_id", organization.id)
        .eq("status", "active"),
      supabase
        .from("employee_weekdays")
        .select("user_id, weekday, available, starts_at, ends_at")
        .eq("organization_id", organization.id),
      supabase
        .from("employee_exceptions")
        .select("user_id, work_date, available, starts_at, ends_at")
        .eq("organization_id", organization.id),
      supabase
        .from("schedule_shifts")
        .select("id, user_id, work_date, kind, start_minutes, end_minutes")
        .eq("organization_id", organization.id),
      supabase.from("member_scopes").select("user_id, scope_key").eq("organization_id", organization.id),
    ]);
    for (const result of [members, weekdays, exceptions, shifts, extras]) {
      if (result.error) return { ok: false, error: mapLoadError(result.error) };
    }

    const weekRows = (weekdays.data ?? []) as WeekRow[];
    const exceptionRows = (exceptions.data ?? []) as ExceptionRow[];
    const extraRows = (extras.data ?? []) as { user_id: string; scope_key: string }[];
    const people = ((members.data ?? []) as MemberRow[])
      .map((member) => {
        const profile = one(member.profiles);
        const role = one(member.roles);
        return {
          userId: member.user_id,
          name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.account_id || "",
          role: visibleRoleName(role?.name),
          cashier: hasEffectiveScope(
            {
              isOwner: Boolean(member.is_owner),
              roleScopes: (role?.role_scopes ?? []).map((scope) => scope.scope_key),
              extraScopes: extraRows.filter((extra) => extra.user_id === member.user_id).map((extra) => extra.scope_key),
            },
            CASHIER,
          ),
          weekdays: fullWeek(weekRows.filter((row) => row.user_id === member.user_id)),
          exceptions: exceptionRows
            .filter((row) => row.user_id === member.user_id)
            .map((row) => ({
              workDate: row.work_date.slice(0, 10),
              available: row.available,
              startsAt: row.available ? clock(row.starts_at) : null,
              endsAt: row.available ? clock(row.ends_at) : null,
            })),
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    const drawn = ((shifts.data ?? []) as unknown[]).map(shiftFrom).filter((shift): shift is ScheduleShift => shift !== null);
    return { ok: true, allowed: true, organizationName: organization.name, people, shifts: drawn };
  } catch {
    return { ok: false, error: "failed" };
  }
}

export async function loadOwnShifts(): Promise<{ ok: true; shifts: ScheduleShift[] } | { ok: false; error: ScheduleLoadError }> {
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  try {
    const supabase = await createClient();
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) return { ok: true, shifts: [] };
    const { data, error } = await supabase
      .from("schedule_shifts")
      .select("id, user_id, work_date, kind, start_minutes, end_minutes")
      .eq("organization_id", organization.id)
      .eq("user_id", user.user.id);
    if (error) return { ok: false, error: mapLoadError(error) };
    const shifts = ((data ?? []) as unknown[]).map(shiftFrom).filter((shift): shift is ScheduleShift => shift !== null);
    return { ok: true, shifts };
  } catch {
    return { ok: false, error: "failed" };
  }
}

function fullWeek(rows: WeekRow[]): ScheduleWindow[] {
  return [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const row = rows.find((item) => item.weekday === weekday);
    return {
      weekday,
      available: Boolean(row?.available),
      startsAt: row?.available ? clock(row.starts_at) : null,
      endsAt: row?.available ? clock(row.ends_at) : null,
    };
  });
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function clock(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function mapLoadError(error: { code?: string; message?: string }): ScheduleLoadError {
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  if (message.includes("forbidden") || error.code === "42501") return "forbidden";
  if (message.includes("pgrst") || message.includes("could not find") || message.includes("does not exist")) return "unavailable";
  return "failed";
}

function mapWriteError(error: { code?: string; message?: string } | null): ScheduleWriteError {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (message.includes("not_found") || error?.code === "P0002") return "not_found";
  if (message.includes("cashier")) return "cashier";
  if (message.includes("overlap")) return "overlap";
  if (message.includes("range") || message.includes("invalid") || error?.code === "22023") return "range";
  if (message.includes("forbidden") || error?.code === "42501") return "forbidden";
  if (message.includes("pgrst") || message.includes("could not find") || message.includes("does not exist")) return "unavailable";
  return "failed";
}

function shiftFrom(value: unknown): ScheduleShift | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const start = typeof row.start_minutes === "number" ? row.start_minutes : Number(row.start_minutes);
  const end = typeof row.end_minutes === "number" ? row.end_minutes : Number(row.end_minutes);
  const workDate = typeof row.work_date === "string" ? row.work_date.slice(0, 10) : "";
  const kind = row.kind === "cash" || row.kind === "tournament" || row.kind === "cashier" ? row.kind : null;
  if (typeof row.id !== "string" || typeof row.user_id !== "string" || !workDate || !kind) return null;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  return { id: row.id, userId: row.user_id, workDate, kind, startMinutes: start, endMinutes: end };
}

async function writeShift(fn: string, args: Record<string, unknown>): Promise<{ ok: true; shift: ScheduleShift } | { ok: false; error: ScheduleWriteError }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: mapWriteError(error) };
  const shift = shiftFrom(data);
  if (!shift) return { ok: false, error: "failed" };
  return { ok: true, shift };
}

function shiftArgs(organizationId: string, shift: ScheduleShift) {
  return {
    p_organization_id: organizationId,
    p_id: shift.id,
    p_user_id: shift.userId,
    p_work_date: shift.workDate,
    p_kind: shift.kind,
    p_start_minutes: shift.startMinutes,
    p_end_minutes: shift.endMinutes,
  };
}

export async function addScheduleShift(organizationId: string, shift: ScheduleShift) {
  return writeShift("add_schedule_shift", shiftArgs(organizationId, shift));
}

export async function moveScheduleShift(organizationId: string, shift: ScheduleShift) {
  return writeShift("move_schedule_shift", shiftArgs(organizationId, shift));
}

export async function deleteScheduleShift(organizationId: string, id: string): Promise<{ ok: true } | { ok: false; error: ScheduleWriteError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_schedule_shift", { p_organization_id: organizationId, p_id: id });
  if (error) return { ok: false, error: mapWriteError(error) };
  return { ok: true };
}
