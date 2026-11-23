"use server";

import { redirect } from "next/navigation";

import {
  employeeReturnPath,
  parseEmployeeException,
  parseEmployeeId,
  parseEmployeeNote,
  parseEmployeeProfile,
  parseEmployeeWeek,
  type EmployeeExceptionInput,
  type EmployeeFormError,
} from "@/lib/employees/validation";
import { organizationFromRequest } from "@/server/services/scopes";
import {
  addEmployeeNote,
  addEmployeeNoteAndRead,
  deleteEmployeeException,
  deleteEmployeeNote,
  listOwnExceptionKeys,
  saveEmployeeException,
  saveEmployeeProfile,
  saveEmployeeWeek,
  setEmployeeNoteVisible,
} from "@/server/services/employees";

function pageOf(formData: FormData) {
  return formData.get("returnTo") === "me" ? "me" : "employees";
}

function finish(formData: FormData, userId: string | null, error?: EmployeeFormError): never {
  redirect(employeeReturnPath({ page: pageOf(formData), userId: userId ?? undefined, error }));
}

async function organizationId(formData: FormData, userId: string | null) {
  const organization = await organizationFromRequest();
  if (!organization) finish(formData, userId, "forbidden");
  return organization.id;
}

export async function saveMyInformationAction(input: {
  phone: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  other: string;
  days: { weekday: number; available: boolean; startsAt: string; endsAt: string }[];
  exceptions: { workDate: string; available: boolean; startsAt: string; endsAt: string }[];
  removedExceptionIds: string[];
}): Promise<
  { ok: true; exceptions: { id: string; workDate: string }[] } | { ok: false; error: EmployeeFormError }
> {
  const profile = parseEmployeeProfile(input);
  const week = parseEmployeeWeek({ days: input.days });
  if (!profile.ok || !week.ok) return { ok: false, error: "invalid" };

  const exceptions: EmployeeExceptionInput[] = [];
  for (const day of input.exceptions) {
    const parsed = parseEmployeeException(day);
    if (!parsed.ok) return { ok: false, error: "invalid" };
    exceptions.push(parsed.data);
  }

  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  const savedProfile = await saveEmployeeProfile(organization.id, profile.data);
  if (!savedProfile.ok) return savedProfile;
  const savedWeek = await saveEmployeeWeek(organization.id, week.data);
  if (!savedWeek.ok) return savedWeek;

  for (const id of input.removedExceptionIds) {
    if (!parseEmployeeId(id)) continue;
    const removed = await deleteEmployeeException(organization.id, id);
    if (!removed.ok && removed.error !== "not_found") return removed;
  }
  for (const day of exceptions) {
    const saved = await saveEmployeeException(organization.id, day);
    if (!saved.ok) return saved;
  }
  return listOwnExceptionKeys(organization.id);
}

export async function createEmployeeNoteAction(input: {
  userId: string;
  kind: "evaluation" | "comment";
  body: string;
  visible: boolean;
}) {
  const parsed = parseEmployeeNote(input);
  if (!parsed.ok) return parsed;
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false as const, error: "forbidden" as const };
  return addEmployeeNoteAndRead(organization.id, parsed.data);
}

export async function setEmployeeNoteVisibleStateAction(noteId: string, visible: boolean) {
  const id = parseEmployeeId(noteId);
  if (!id) return { ok: false as const, error: "invalid" as const };
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false as const, error: "forbidden" as const };
  return setEmployeeNoteVisible(organization.id, id, visible);
}

export async function deleteEmployeeNoteStateAction(noteId: string) {
  const id = parseEmployeeId(noteId);
  if (!id) return { ok: false as const, error: "invalid" as const };
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false as const, error: "forbidden" as const };
  return deleteEmployeeNote(organization.id, id);
}

export async function saveEmployeeProfileAction(formData: FormData) {
  const parsed = parseEmployeeProfile({
    phone: formData.get("phone"),
    address: formData.get("address"),
    emergencyName: formData.get("emergencyName"),
    emergencyPhone: formData.get("emergencyPhone"),
    other: formData.get("other"),
  });
  if (!parsed.ok) finish(formData, null, parsed.error);
  const organizationIdValue = await organizationId(formData, null);
  const saved = await saveEmployeeProfile(organizationIdValue, parsed.data);
  if (!saved.ok) finish(formData, null, saved.error);
  finish(formData, null);
}

export async function saveEmployeeWeekAction(formData: FormData) {
  const parsed = parseEmployeeWeek({
    days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      weekday,
      available: formData.get(`available-${weekday}`),
      startsAt: formData.get(`start-${weekday}`),
      endsAt: formData.get(`end-${weekday}`),
    })),
  });
  if (!parsed.ok) finish(formData, null, parsed.error);
  const organizationIdValue = await organizationId(formData, null);
  const saved = await saveEmployeeWeek(organizationIdValue, parsed.data);
  if (!saved.ok) finish(formData, null, saved.error);
  finish(formData, null);
}

export async function saveEmployeeExceptionAction(formData: FormData) {
  const parsed = parseEmployeeException({
    workDate: formData.get("workDate"),
    available: formData.get("available"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.ok) finish(formData, null, parsed.error);
  const organizationIdValue = await organizationId(formData, null);
  const saved = await saveEmployeeException(organizationIdValue, parsed.data);
  if (!saved.ok) finish(formData, null, saved.error);
  finish(formData, null);
}

export async function deleteEmployeeExceptionAction(formData: FormData) {
  const exceptionId = parseEmployeeId(formData.get("exceptionId"));
  if (!exceptionId) finish(formData, null, "invalid");
  const organizationIdValue = await organizationId(formData, null);
  const saved = await deleteEmployeeException(organizationIdValue, exceptionId);
  if (!saved.ok) finish(formData, null, saved.error);
  finish(formData, null);
}

export async function addEmployeeNoteAction(formData: FormData) {
  const parsed = parseEmployeeNote({
    userId: formData.get("userId"),
    kind: formData.get("kind"),
    body: formData.get("body"),
    visible: formData.get("visible"),
  });
  const userId = parsed.ok ? parsed.data.userId : parseEmployeeId(formData.get("userId"));
  if (!parsed.ok) finish(formData, userId, parsed.error);
  const organizationIdValue = await organizationId(formData, userId);
  const saved = await addEmployeeNote(organizationIdValue, parsed.data);
  if (!saved.ok) finish(formData, userId, saved.error);
  finish(formData, userId);
}

export async function setEmployeeNoteVisibleAction(formData: FormData) {
  const noteId = parseEmployeeId(formData.get("noteId"));
  const userId = parseEmployeeId(formData.get("userId"));
  if (!noteId) finish(formData, userId, "invalid");
  const organizationIdValue = await organizationId(formData, userId);
  const saved = await setEmployeeNoteVisible(organizationIdValue, noteId, formData.get("visible") === "1");
  if (!saved.ok) finish(formData, userId, saved.error);
  finish(formData, userId);
}

export async function deleteEmployeeNoteAction(formData: FormData) {
  const noteId = parseEmployeeId(formData.get("noteId"));
  const userId = parseEmployeeId(formData.get("userId"));
  if (!noteId) finish(formData, userId, "invalid");
  const organizationIdValue = await organizationId(formData, userId);
  const saved = await deleteEmployeeNote(organizationIdValue, noteId);
  if (!saved.ok) finish(formData, userId, saved.error);
  finish(formData, userId);
}
