import "server-only";

import { headers } from "next/headers";

import { accountEmail } from "@/lib/auth/account-email";
import { ACCOUNTS, BADBEAT_ENTRY, BADBEAT_STATS, EMPLOYEES, hasEffectiveScope, PROMOTIONS, SCHEDULE, SCOPE_MANAGER } from "@/lib/scopes/effective";
import type { ScopeFormError } from "@/lib/scopes/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ORGANIZATION_HOST_HEADER, requestSite } from "@/lib/tenant/host";
import { getAccess } from "@/server/authorization/platform-admin";

export type ScopeRole = {
  id: string;
  name: string;
  description: string;
  system: boolean;
  scopes: string[];
};

export type ScopeMember = {
  userId: string;
  accountId: string;
  firstName: string;
  lastName: string;
  roleId: string;
  status: "active" | "disabled";
  isOwner: boolean;
  extraScopes: string[];
};

export type ScopeManagerData = {
  organizationId: string;
  organizationName: string;
  slug: string;
  allowed: boolean;
  scopes: string[];
  roles: ScopeRole[];
  members: ScopeMember[];
};

type RoleEmbed = { name?: string; role_scopes?: { scope_key: string }[] | null } | null;
type ProfileEmbed = { account_id: string; first_name: string | null; last_name: string | null } | null;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapError(error: { code?: string; message?: string } | null): ScopeFormError {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (message.includes("owner_locked")) return "owner_locked";
  if (message.includes("role_in_use")) return "role_in_use";
  if (message.includes("role_invalid")) return "role_invalid";
  if (message.includes("invalid_scope") || message.includes("scopes_key")) return "invalid";
  if (message.includes("roles_organization_name")) return "role_taken";
  if (message.includes("organization_members_unique") || message.includes("profiles_account_id")) {
    return "account_taken";
  }
  if (message.includes("password")) return "password_short";
  if (message.includes("not_found") || error?.code === "P0002") return "not_found";
  if (message.includes("forbidden") || error?.code === "42501") return "forbidden";
  if (message.includes("pgrst") || message.includes("could not find") || message.includes("does not exist")) {
    return "unavailable";
  }
  return "failed";
}

export async function organizationFromRequest(): Promise<{ id: string; name: string; slug: string } | null> {
  const headerStore = await headers();
  const parsed = requestSite(headerStore.get("host") ?? "", headerStore.get("x-forwarded-proto")).host;
  const slug = headerStore.get(ORGANIZATION_HOST_HEADER) ?? (parsed.kind === "tenant" ? parsed.slug : null);
  if (!slug) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data?.id || !data.name || !data.slug) return null;
  return { id: data.id as string, name: data.name as string, slug: data.slug as string };
}

async function viewer(): Promise<{ userId: string; host: boolean } | null> {
  const access = await getAccess();
  if (access.kind === "host") return { userId: access.userId, host: true };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, host: false };
}

export async function navigationAccess(slug: string): Promise<{
  accounts: boolean;
  scopes: boolean;
  employees: boolean;
  badbeatEntry: boolean;
  badbeatStats: boolean;
  promotions: boolean;
  schedule: boolean;
  self: boolean;
}> {
  const none = {
    accounts: false,
    scopes: false,
    employees: false,
    badbeatEntry: false,
    badbeatStats: false,
    promotions: false,
    schedule: false,
    self: false,
  };
  try {
    const person = await viewer();
    if (!person) return none;
    if (person.host) {
      return {
        accounts: true,
        scopes: true,
        employees: true,
        badbeatEntry: true,
        badbeatStats: true,
        promotions: true,
        schedule: true,
        self: false,
      };
    }
    const supabase = await createClient();
    const organizationId = await organizationIdBySlug(supabase, slug);
    if (!organizationId) return none;
    const held = await memberHeld(supabase, organizationId, person.userId);
    if (!held) return none;
    return {
      accounts: hasEffectiveScope(held, ACCOUNTS),
      scopes: hasEffectiveScope(held, SCOPE_MANAGER),
      employees: hasEffectiveScope(held, EMPLOYEES),
      badbeatEntry: hasEffectiveScope(held, BADBEAT_ENTRY),
      badbeatStats: hasEffectiveScope(held, BADBEAT_STATS),
      promotions: hasEffectiveScope(held, PROMOTIONS),
      schedule: hasEffectiveScope(held, SCHEDULE),
      self: true,
    };
  } catch {
    return none;
  }
}

export async function loadScopeManager(
  slug: string,
  required: string = SCOPE_MANAGER,
): Promise<{ ok: true; allowed: boolean; data: ScopeManagerData | null } | { ok: false; error: ScopeFormError }> {
  const person = await viewer();
  if (!person) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (organizationError) return { ok: false, error: mapError(organizationError) };
  if (!organization?.id) return { ok: false, error: "not_found" };

  const organizationId = organization.id as string;
  const held = person.host ? null : await memberHeld(supabase, organizationId, person.userId);
  const allowed = person.host || (held != null && hasEffectiveScope(held, required));
  if (!allowed) {
    return {
      ok: true,
      allowed: false,
      data: {
        organizationId,
        organizationName: organization.name as string,
        slug: organization.slug as string,
        allowed: false,
        scopes: [],
        roles: [],
        members: [],
      },
    };
  }

  const [scopeRows, organizationRoles, systemRoles, memberRows, extraRows] = await Promise.all([
    supabase.from("scopes").select("key").order("key"),
    supabase
      .from("roles")
      .select("id, name, description, is_system_role, organization_id, role_scopes(scope_key)")
      .eq("organization_id", organizationId),
    supabase
      .from("roles")
      .select("id, name, description, is_system_role, organization_id, role_scopes(scope_key)")
      .is("organization_id", null)
      .eq("is_system_role", true),
    supabase
      .from("organization_members")
      .select("user_id, role_id, status, is_owner, profiles(account_id, first_name, last_name)")
      .eq("organization_id", organizationId)
      .order("created_at"),
    supabase.from("member_scopes").select("user_id, scope_key").eq("organization_id", organizationId),
  ]);

  const failed =
    scopeRows.error || organizationRoles.error || systemRoles.error || memberRows.error || extraRows.error;
  if (failed) return { ok: false, error: mapError(failed) };

  const extras = new Map<string, string[]>();
  for (const row of (extraRows.data ?? []) as { user_id: string; scope_key: string }[]) {
    const list = extras.get(row.user_id) ?? [];
    list.push(row.scope_key);
    extras.set(row.user_id, list);
  }

  const roles = ([...(organizationRoles.data ?? []), ...(systemRoles.data ?? [])] as {
    id: string;
    name: string;
    description: string | null;
    is_system_role: boolean;
    organization_id: string | null;
    role_scopes: { scope_key: string }[] | null;
  }[])
    .filter((role) => role.organization_id === organizationId || role.name === "staff" || role.name === "organization_admin")
    .map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description ?? "",
      system: role.is_system_role,
      scopes: (role.role_scopes ?? []).map((scope) => scope.scope_key).sort(),
    }))
    .sort((left, right) => Number(right.system) - Number(left.system) || left.name.localeCompare(right.name));

  const members = ((memberRows.data ?? []) as {
    user_id: string;
    role_id: string;
    status: "active" | "disabled";
    is_owner: boolean;
    profiles: ProfileEmbed | ProfileEmbed[];
  }[]).flatMap((member) => {
    const profile = one(member.profiles);
    if (!profile?.account_id) return [];
    return [
      {
        userId: member.user_id,
        accountId: profile.account_id,
        firstName: profile.first_name?.trim() ?? "",
        lastName: profile.last_name?.trim() ?? "",
        roleId: member.role_id,
        status: member.status,
        isOwner: member.is_owner,
        extraScopes: (extras.get(member.user_id) ?? []).sort(),
      },
    ];
  });

  return {
    ok: true,
    allowed: true,
    data: {
      organizationId,
      organizationName: organization.name as string,
      slug: organization.slug as string,
      allowed: true,
      scopes: ((scopeRows.data ?? []) as { key: string }[]).map((scope) => scope.key),
      roles,
      members,
    },
  };
}

async function organizationIdBySlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string,
): Promise<string | null> {
  const { data, error } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}

async function memberHeld(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string,
): Promise<{ isOwner: boolean; roleScopes: string[]; extraScopes: string[] } | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("is_owner, status, roles(role_scopes(scope_key))")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.status !== "active") return null;

  const role = one(data.roles as RoleEmbed | RoleEmbed[]);
  const { data: extras } = await supabase
    .from("member_scopes")
    .select("scope_key")
    .eq("organization_id", organizationId)
    .eq("user_id", userId);
  return {
    isOwner: Boolean(data.is_owner),
    roleScopes: (role?.role_scopes ?? []).map((scope) => scope.scope_key),
    extraScopes: ((extras ?? []) as { scope_key: string }[]).map((scope) => scope.scope_key),
  };
}

export async function createRole(
  organizationId: string,
  input: { name: string; description: string; scopes: string[] },
): Promise<{ ok: true } | { ok: false; error: ScopeFormError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_role", {
    p_organization_id: organizationId,
    p_name: input.name,
    p_description: input.description,
    p_scopes: input.scopes,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function updateRole(
  organizationId: string,
  input: { roleId: string; name: string; description: string; scopes: string[] },
): Promise<{ ok: true } | { ok: false; error: ScopeFormError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization_role", {
    p_organization_id: organizationId,
    p_role_id: input.roleId,
    p_name: input.name,
    p_description: input.description,
    p_scopes: input.scopes,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function deleteRole(
  organizationId: string,
  roleId: string,
): Promise<{ ok: true } | { ok: false; error: ScopeFormError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_organization_role", {
    p_organization_id: organizationId,
    p_role_id: roleId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function createMember(
  organizationId: string,
  userId: string,
  input: { roleId: string; scopes: string[] },
): Promise<{ ok: true } | { ok: false; error: ScopeFormError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_member", {
    p_organization_id: organizationId,
    p_user_id: userId,
    p_role_id: input.roleId,
    p_scopes: input.scopes,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function setMemberAccess(
  organizationId: string,
  input: { userId: string; roleId: string; status: "active" | "disabled"; scopes: string[]; password: string },
): Promise<{ ok: true } | { ok: false; error: ScopeFormError }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_access", {
    p_organization_id: organizationId,
    p_user_id: input.userId,
    p_role_id: input.roleId,
    p_status: input.status,
    p_scopes: input.scopes,
  });
  if (error) return { ok: false, error: mapError(error) };

  if (!input.password) return { ok: true };
  if (!process.env.SUPABASE_SECRET_KEY) return { ok: false, error: "unavailable" };
  const updated = await createAdminClient().auth.admin.updateUserById(input.userId, {
    password: input.password,
  });
  if (updated.error) return { ok: false, error: mapError(updated.error) };
  return { ok: true };
}

export function employeeEmail(accountId: string) {
  return accountEmail(accountId);
}
