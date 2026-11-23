"use server";

import { redirect } from "next/navigation";

import { accountEmail } from "@/lib/auth/account-email";
import {
  isScopeFormError,
  parseCreateEmployee,
  parseMemberAccess,
  parseRole,
  type ScopeFormError,
} from "@/lib/scopes/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createMember,
  createRole,
  deleteRole,
  organizationFromRequest,
  setMemberAccess,
  updateRole,
} from "@/server/services/scopes";

export type ScopeActionState = { error: ScopeFormError | null };

async function organizationId(): Promise<{ ok: true; id: string } | { ok: false; error: ScopeFormError }> {
  const organization = await organizationFromRequest();
  if (!organization) return { ok: false, error: "forbidden" };
  return { ok: true, id: organization.id };
}

export async function createEmployeeAction(
  _state: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  const parsed = parseCreateEmployee({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    accountId: formData.get("accountId"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    roleId: formData.get("roleId"),
    scopes: formData.getAll("scopes"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const organization = await organizationId();
  if (!organization.ok) return { error: organization.error };
  if (!process.env.SUPABASE_SECRET_KEY) return { error: "unavailable" };

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: accountEmail(parsed.data.accountId),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      account_id: parsed.data.accountId,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
    },
  });
  if (created.error || !created.data.user) {
    const message = `${created.error?.message ?? ""}`.toLowerCase();
    if (message.includes("already") || message.includes("exists") || message.includes("duplicate")) {
      return { error: "account_taken" };
    }
    if (message.includes("password")) return { error: "password_short" };
    return { error: "failed" };
  }

  const saved = await createMember(organization.id, created.data.user.id, parsed.data);
  if (!saved.ok) {
    const removed = await admin.auth.admin.deleteUser(created.data.user.id);
    if (removed.error) return { error: "failed" };
    return { error: saved.error };
  }

  redirect("/accounts?saved=1");
}

export async function updateMemberAction(
  _state: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  const parsed = parseMemberAccess({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
    status: formData.get("status"),
    scopes: formData.getAll("scopes"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const organization = await organizationId();
  if (!organization.ok) return { error: organization.error };
  const saved = await setMemberAccess(organization.id, parsed.data);
  if (!saved.ok) return { error: saved.error };
  redirect("/scopes?tab=scopes&saved=1");
}

export async function saveRoleAction(
  _state: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  const parsed = parseRole({
    roleId: formData.get("roleId"),
    name: formData.get("name"),
    description: formData.get("description"),
    scopes: formData.getAll("scopes"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const organization = await organizationId();
  if (!organization.ok) return { error: organization.error };
  const saved = parsed.data.roleId
    ? await updateRole(organization.id, {
        roleId: parsed.data.roleId,
        name: parsed.data.name,
        description: parsed.data.description,
        scopes: parsed.data.scopes,
      })
    : await createRole(organization.id, parsed.data);
  if (!saved.ok) return { error: saved.error };
  redirect("/scopes?tab=roles&saved=1");
}

export async function deleteRoleAction(formData: FormData) {
  const roleId = String(formData.get("roleId") ?? "");
  const organization = await organizationId();
  if (!organization.ok || !roleId) redirect("/scopes?tab=roles&error=invalid");
  const saved = await deleteRole(organization.id, roleId);
  if (!saved.ok) {
    const error = isScopeFormError(saved.error) ? saved.error : "failed";
    redirect(`/scopes?tab=roles&error=${error}`);
  }
  redirect("/scopes?tab=roles&saved=1");
}
