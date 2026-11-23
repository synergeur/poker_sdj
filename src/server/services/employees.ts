import "server-only";

import type { EmployeeFormError } from "@/lib/employees/validation";
import type {
  EmployeeException,
  EmployeeNote,
  EmployeePerson,
  EmployeeWeekday,
} from "@/lib/employees/types";
import type {
  EmployeeExceptionInput,
  EmployeeNoteInput,
  EmployeeProfileInput,
  WeekdayInput,
} from "@/lib/employees/validation";
import { createClient } from "@/lib/supabase/server";
import { organizationFromRequest } from "@/server/services/scopes";

export type EmployeeDirectory =
  | { ok: false; error: EmployeeFormError }
  | { ok: true; allowed: false; organizationName: string }
  | { ok: true; allowed: true; organizationName: string; people: EmployeePerson[] };

export type OwnEmployee =
  | { ok: false; error: EmployeeFormError }
  | { ok: true; allowed: false; organizationName: string }
  | { ok: true; allowed: true; organizationName: string; person: EmployeePerson };

type MemberRow = {
  user_id: string;
  status: string;
  is_owner: boolean;
  profiles:
    | { account_id: string; first_name: string | null; last_name: string | null }
    | { account_id: string; first_name: string | null; last_name: string | null }[]
    | null;
  roles: { name: string } | { name: string }[] | null;
};

type ProfileRow = {
  user_id: string;
  phone: string;
  address: string;
  emergency_name: string;
  emergency_phone: string;
  other: string;
};

type WeekRow = { user_id: string; weekday: number; available: boolean; starts_at: string | null; ends_at: string | null };
type ExceptionRow = {
  id: string;
  user_id: string;
  work_date: string;
  available: boolean;
  starts_at: string | null;
  ends_at: string | null;
};
type SavedNoteRow = {
  id: string;
  body: string;
  visible_to_employee: boolean;
  created_at: string;
};

type NoteRow = {
  id: string;
  user_id: string;
  author_id: string;
  kind: string;
  body: string;
  visible_to_employee: boolean;
  created_at: string;
};
type NameRow = { id: string; account_id: string; first_name: string | null; last_name: string | null };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapError(error: { code?: string; message?: string } | null): EmployeeFormError {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (message.includes("not_found") || error?.code === "P0002") return "not_found";
  if (message.includes("invalid") || error?.code === "22023" || error?.code === "22007") return "invalid";
  if (message.includes("forbidden") || error?.code === "42501") return "forbidden";
  if (message.includes("pgrst") || message.includes("could not find") || message.includes("does not exist")) {
    return "unavailable";
  }
  return "failed";
}

function clock(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function fullWeek(rows: WeekRow[]): EmployeeWeekday[] {
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

function displayName(row: NameRow | undefined) {
  if (!row) return "";
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.account_id;
}

export async function loadEmployeeDirectory(allowed: boolean): Promise<EmployeeDirectory> {
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  if (!allowed) return { ok: true, allowed: false, organizationName: organization.name };
  try {
    const people = await loadPeople(organization.id, null, false);
    return { ok: true, allowed: true, organizationName: organization.name, people };
  } catch (error) {
    return { ok: false, error: error instanceof EmployeeReadError ? error.formError : "failed" };
  }
}

export async function currentEmployeeUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function loadOwnEmployee(userId: string): Promise<OwnEmployee> {
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  try {
    const people = await loadPeople(organization.id, userId, true);
    const person = people[0];
    if (!person) return { ok: true, allowed: false, organizationName: organization.name };
    return { ok: true, allowed: true, organizationName: organization.name, person };
  } catch (error) {
    return { ok: false, error: error instanceof EmployeeReadError ? error.formError : "failed" };
  }
}

class EmployeeReadError extends Error {
  constructor(readonly formError: EmployeeFormError) {
    super(formError);
  }
}

async function loadPeople(organizationId: string, onlyUserId: string | null, sharedOnly: boolean) {
  const supabase = await createClient();
  let membersQuery = supabase
    .from("organization_members")
    .select("user_id, status, is_owner, profiles(account_id, first_name, last_name), roles(name)")
    .eq("organization_id", organizationId);
  let profileQuery = supabase
    .from("employee_profiles")
    .select("user_id, phone, address, emergency_name, emergency_phone, other")
    .eq("organization_id", organizationId);
  let weekQuery = supabase
    .from("employee_weekdays")
    .select("user_id, weekday, available, starts_at, ends_at")
    .eq("organization_id", organizationId);
  let exceptionQuery = supabase
    .from("employee_exceptions")
    .select("id, user_id, work_date, available, starts_at, ends_at")
    .eq("organization_id", organizationId);
  let noteQuery = supabase
    .from("employee_notes")
    .select("id, user_id, author_id, kind, body, visible_to_employee, created_at")
    .eq("organization_id", organizationId);
  if (onlyUserId) {
    membersQuery = membersQuery.eq("user_id", onlyUserId).eq("status", "active");
    profileQuery = profileQuery.eq("user_id", onlyUserId);
    weekQuery = weekQuery.eq("user_id", onlyUserId);
    exceptionQuery = exceptionQuery.eq("user_id", onlyUserId);
    noteQuery = noteQuery.eq("user_id", onlyUserId);
  }
  const [members, profiles, weekdays, exceptions, notes] = await Promise.all([
    membersQuery,
    profileQuery,
    weekQuery,
    exceptionQuery,
    noteQuery,
  ]);
  for (const result of [members, profiles, weekdays, exceptions, notes]) {
    if (result.error) throw new EmployeeReadError(mapError(result.error));
  }

  const noteRows = (notes.data ?? []) as NoteRow[];
  const authorIds = [...new Set(noteRows.map((note) => note.author_id))];
  const authors = new Map<string, NameRow>();
  if (authorIds.length > 0) {
    const authorResult = await supabase.from("profiles").select("id, account_id, first_name, last_name").in("id", authorIds);
    if (authorResult.error) throw new EmployeeReadError(mapError(authorResult.error));
    for (const author of (authorResult.data ?? []) as NameRow[]) authors.set(author.id, author);
  }

  const profileRows = (profiles.data ?? []) as ProfileRow[];
  const weekRows = (weekdays.data ?? []) as WeekRow[];
  const exceptionRows = (exceptions.data ?? []) as ExceptionRow[];

  return ((members.data ?? []) as MemberRow[])
    .filter((member) => member.status === "active" || member.status === "disabled")
    .map((member) => {
      const profile = one(member.profiles);
      const role = one(member.roles);
      const details = profileRows.find((row) => row.user_id === member.user_id);
      const personNotes = noteRows
        .filter((note) => note.user_id === member.user_id && (!sharedOnly || note.visible_to_employee))
        .sort((left, right) => right.created_at.localeCompare(left.created_at));
      const toNote = (note: NoteRow): EmployeeNote => ({
        id: note.id,
        body: note.body,
        visibleToEmployee: note.visible_to_employee,
        createdAt: note.created_at,
        authorName: displayName(authors.get(note.author_id)),
      });
      const person: EmployeePerson = {
        userId: member.user_id,
        accountId: profile?.account_id ?? "",
        firstName: profile?.first_name?.trim() ?? "",
        lastName: profile?.last_name?.trim() ?? "",
        roleName: role?.name ?? "staff",
        status: member.status === "disabled" ? "disabled" : "active",
        isOwner: Boolean(member.is_owner),
        phone: details?.phone ?? "",
        address: details?.address ?? "",
        emergencyName: details?.emergency_name ?? "",
        emergencyPhone: details?.emergency_phone ?? "",
        other: details?.other ?? "",
        weekdays: fullWeek(weekRows.filter((row) => row.user_id === member.user_id)),
        exceptions: exceptionRows
          .filter((row) => row.user_id === member.user_id)
          .sort((left, right) => left.work_date.localeCompare(right.work_date))
          .map((row): EmployeeException => ({
            id: row.id,
            workDate: row.work_date.slice(0, 10),
            available: row.available,
            startsAt: row.available ? clock(row.starts_at) : null,
            endsAt: row.available ? clock(row.ends_at) : null,
          })),
        evaluations: personNotes.filter((note) => note.kind === "evaluation").map(toNote),
        comments: personNotes.filter((note) => note.kind === "comment").map(toNote),
      };
      return person;
    })
    .sort((left, right) => personName(left).localeCompare(personName(right)));
}

function personName(person: EmployeePerson) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.accountId;
}

async function call(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: EmployeeFormError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function saveEmployeeProfile(organizationId: string, input: EmployeeProfileInput) {
  return call("save_employee_profile", {
    p_organization_id: organizationId,
    p_phone: input.phone,
    p_address: input.address,
    p_emergency_name: input.emergencyName,
    p_emergency_phone: input.emergencyPhone,
    p_other: input.other,
  });
}

export async function saveEmployeeWeek(organizationId: string, days: WeekdayInput[]) {
  return call("save_employee_week", {
    p_organization_id: organizationId,
    p_days: days.map((day) => ({
      weekday: day.weekday,
      available: day.available,
      starts_at: day.startsAt,
      ends_at: day.endsAt,
    })),
  });
}

export async function saveEmployeeException(organizationId: string, input: EmployeeExceptionInput) {
  return call("save_employee_exception", {
    p_organization_id: organizationId,
    p_work_date: input.workDate,
    p_available: input.available,
    p_starts_at: input.available ? input.startsAt : null,
    p_ends_at: input.available ? input.endsAt : null,
  });
}

export async function deleteEmployeeException(organizationId: string, exceptionId: string) {
  return call("delete_employee_exception", { p_organization_id: organizationId, p_id: exceptionId });
}

export async function addEmployeeNote(organizationId: string, input: EmployeeNoteInput) {
  return call("add_employee_note", {
    p_organization_id: organizationId,
    p_user_id: input.userId,
    p_kind: input.kind,
    p_body: input.body,
    p_visible: input.visible,
  });
}

export async function addEmployeeNoteAndRead(
  organizationId: string,
  input: EmployeeNoteInput,
): Promise<{ ok: true; note: EmployeeNote } | { ok: false; error: EmployeeFormError }> {
  const saved = await addEmployeeNote(organizationId, input);
  if (!saved.ok) return saved;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false, error: "forbidden" };
  const { data, error } = await supabase
    .from("employee_notes")
    .select("id, body, visible_to_employee, created_at, author_id")
    .eq("organization_id", organizationId)
    .eq("user_id", input.userId)
    .eq("author_id", auth.user.id)
    .eq("kind", input.kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error ? mapError(error) : "failed" };
  const author = await supabase
    .from("profiles")
    .select("id, account_id, first_name, last_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  const row = data as SavedNoteRow;
  return {
    ok: true,
    note: {
      id: row.id,
      body: row.body,
      visibleToEmployee: row.visible_to_employee,
      createdAt: row.created_at,
      authorName: displayName((author.data as NameRow | null) ?? undefined),
    },
  };
}

export async function listOwnExceptionKeys(
  organizationId: string,
): Promise<{ ok: true; exceptions: { id: string; workDate: string }[] } | { ok: false; error: EmployeeFormError }> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false, error: "forbidden" };
  const { data, error } = await supabase
    .from("employee_exceptions")
    .select("id, work_date")
    .eq("organization_id", organizationId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    exceptions: ((data ?? []) as { id: string; work_date: string }[]).map((row) => ({
      id: row.id,
      workDate: row.work_date.slice(0, 10),
    })),
  };
}

export async function setEmployeeNoteVisible(organizationId: string, noteId: string, visible: boolean) {
  return call("set_employee_note_visible", {
    p_organization_id: organizationId,
    p_note_id: noteId,
    p_visible: visible,
  });
}

export async function deleteEmployeeNote(organizationId: string, noteId: string) {
  return call("delete_employee_note", { p_organization_id: organizationId, p_note_id: noteId });
}
