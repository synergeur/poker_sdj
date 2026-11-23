import "server-only";

import { accountEmail, accountIdFromEmail } from "@/lib/auth/account-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FormError } from "@/lib/validation/organization";
import type {
  CreateOrganizationInput,
  OrganizationStatus,
  UpdateOrganizationInput,
} from "@/lib/validation/organization";

import { getAccess } from "@/server/authorization/platform-admin";

export type OrganizationAdmin = {
  userId: string;
  accountId: string;
  firstName: string;
  lastName: string;
};

export type OrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  contactEmail: string | null;
  address: string | null;
  createdAt: string;
  admins: OrganizationAdmin[];
};

type ProfileEmbed =
  | { account_id: string; first_name?: string | null; last_name?: string | null }
  | { account_id: string; first_name?: string | null; last_name?: string | null }[]
  | null;

type RoleEmbed = { name: string } | { name: string }[] | null;

type MemberEmbed = {
  user_id: string;
  profiles: ProfileEmbed;
  roles: RoleEmbed;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  contact_email: string | null;
  address: string | null;
  created_at: string;
  organization_members: MemberEmbed[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function adminsFrom(members: MemberEmbed[] | null): OrganizationAdmin[] {
  if (!members) return [];

  const parsed = members.flatMap((member) => {
    const profile = one(member.profiles);
    if (!profile?.account_id || !member.user_id) return [];
    return [
      {
        userId: member.user_id,
        accountId: profile.account_id,
        firstName: profile.first_name?.trim() ?? "",
        lastName: profile.last_name?.trim() ?? "",
        role: one(member.roles)?.name ?? "",
      },
    ];
  });

  const organisers = parsed.filter((member) => member.role === "organization_admin");
  const chosen = organisers.length > 0 ? organisers : parsed;
  return chosen.map(({ role: _role, ...admin }) => admin);
}

function mapWriteError(error: { code?: string; message?: string }): FormError {
  const message = error.message ?? "";
  if (message.includes("organizations_slug_key")) return "slug_taken";
  if (message.includes("organizations_slug_reserved")) return "slug_reserved";
  if (
    message.includes("organizations_slug_format") ||
    message.includes("organizations_slug_length")
  ) {
    return "slug_invalid";
  }
  if (message.includes("profiles_account_id")) return "account_taken";
  if (message.includes("not_found") || error.code === "P0002") return "invalid";
  if (error.code === "PGRST202" || message.includes("Could not find the function")) return "unavailable";
  if (message.includes("forbidden") || error.code === "42501") return "forbidden";
  return "failed";
}

function mapAuthError(error: { code?: string; message?: string } | null): FormError {
  const message = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (message.includes("already") || message.includes("exists") || message.includes("duplicate")) {
    return "account_taken";
  }
  if (message.includes("password")) return "password_short";
  if (message.includes("missing_supabase")) return "unavailable";
  return "failed";
}

export async function listOrganizations(): Promise<
  { ok: true; organizations: OrganizationListItem[] } | { ok: false; error: FormError }
> {
  const access = await getAccess();
  if (access.kind === "unconfigured") return { ok: false, error: "unavailable" };
  if (access.kind !== "host") return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, status, contact_email, address, created_at, organization_members(user_id, profiles(account_id, first_name, last_name), roles(name))",
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { ok: false, error: "failed" };
  }

  const organizations = await withIssuedAccounts(
    (data as OrganizationRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      contactEmail: row.contact_email,
      address: row.address,
      createdAt: row.created_at,
      admins: adminsFrom(row.organization_members),
    })),
  );

  return { ok: true, organizations };
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<{ ok: true } | { ok: false; error: FormError }> {
  const access = await getAccess();
  if (access.kind === "unconfigured" || !publicSupabaseEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return { ok: false, error: "unavailable" };
  }
  if (access.kind !== "host") {
    return { ok: false, error: "forbidden" };
  }

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: accountEmail(input.adminAccountId),
    password: input.adminPassword,
    email_confirm: true,
    user_metadata: {
      account_id: input.adminAccountId,
      first_name: input.adminFirstName,
      last_name: input.adminLastName,
    },
  });

  if (created.error || !created.data.user) {
    return { ok: false, error: mapAuthError(created.error) };
  }

  const userId = created.data.user.id;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_with_admin", {
    p_name: input.name,
    p_slug: input.slug,
    p_status: input.status,
    p_contact_email: input.contactEmail,
    p_address: input.address,
    p_admin_user_id: userId,
    p_admin_account_id: input.adminAccountId,
  });

  if (error) {
    const removed = await admin.auth.admin.deleteUser(userId);
    if (removed.error) {
      console.error("Failed to roll back the issued account", userId);
      return { ok: false, error: "account_cleanup_failed" };
    }
    return { ok: false, error: mapWriteError(error) };
  }

  return { ok: true };
}

export async function setOrganizationStatus(
  organizationId: string,
  status: OrganizationStatus,
): Promise<{ ok: true } | { ok: false; error: FormError }> {
  const access = await getAccess();
  if (access.kind === "unconfigured") return { ok: false, error: "unavailable" };
  if (access.kind !== "host") return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_organization_status", {
    p_organization_id: organizationId,
    p_status: status,
  });

  if (error) {
    return { ok: false, error: mapWriteError(error) };
  }

  return { ok: true };
}

type StoredOrganization = {
  name: string;
  slug: string;
  contactEmail: string;
  address: string;
  admin: OrganizationAdmin;
};

export async function updateOrganizationAdmin(
  input: UpdateOrganizationInput,
): Promise<{ ok: true } | { ok: false; error: FormError }> {
  const access = await getAccess();
  if (access.kind === "unconfigured" || !publicSupabaseEnv() || !process.env.SUPABASE_SECRET_KEY) {
    return { ok: false, error: "unavailable" };
  }
  if (access.kind !== "host") {
    return { ok: false, error: "forbidden" };
  }
  if (input.adminUserId === access.userId) {
    return { ok: false, error: "forbidden" };
  }

  const supabase = await createClient();
  const { data, error: loadError } = await supabase
    .from("organizations")
    .select(
      "name, slug, contact_email, address, organization_members(user_id, profiles(account_id, first_name, last_name), roles(name))",
    )
    .eq("id", input.organizationId)
    .maybeSingle();

  if (loadError || !data) {
    return { ok: false, error: loadError ? mapWriteError(loadError) : "invalid" };
  }

  const row = data as {
    name: string;
    slug: string;
    contact_email: string | null;
    address: string | null;
    organization_members: MemberEmbed[] | null;
  };
  const current = adminsFrom(row.organization_members).find((admin) => admin.userId === input.adminUserId);
  if (!current) {
    return { ok: false, error: "invalid" };
  }

  const issued = await issuedAccount(input.adminUserId);
  const previous: StoredOrganization = {
    name: row.name,
    slug: row.slug,
    contactEmail: row.contact_email ?? "",
    address: row.address ?? "",
    admin: {
      ...current,
      accountId: issued?.accountId ?? current.accountId,
      firstName: issued?.firstName || current.firstName,
      lastName: issued?.lastName || current.lastName,
    },
  };

  const organizationSaved = await writeOrganizationRecord(supabase, access.userId, input);
  if (!organizationSaved.ok) return organizationSaved;

  const admin = createAdminClient();
  const attributes: {
    email: string;
    email_confirm: boolean;
    user_metadata: { account_id: string; first_name: string; last_name: string };
    password?: string;
  } = {
    email: accountEmail(input.adminAccountId),
    email_confirm: true,
    user_metadata: {
      account_id: input.adminAccountId,
      first_name: input.adminFirstName,
      last_name: input.adminLastName,
    },
  };
  if (input.adminPassword) attributes.password = input.adminPassword;

  const updated = await admin.auth.admin.updateUserById(input.adminUserId, attributes);
  if (updated.error) {
    await writeOrganizationRecord(supabase, access.userId, {
      ...input,
      name: previous.name,
      slug: previous.slug,
      contactEmail: previous.contactEmail,
      address: previous.address,
    });
    return { ok: false, error: mapAuthError(updated.error) };
  }

  const profileSaved = await writeOrganizationAdmin(supabase, input);
  if (!profileSaved.ok && profileSaved.error !== "unavailable") {
    await admin.auth.admin.updateUserById(input.adminUserId, {
      email: accountEmail(previous.admin.accountId),
      email_confirm: true,
      user_metadata: {
        account_id: previous.admin.accountId,
        first_name: previous.admin.firstName,
        last_name: previous.admin.lastName,
      },
    });
    await writeOrganizationRecord(supabase, access.userId, {
      ...input,
      name: previous.name,
      slug: previous.slug,
      contactEmail: previous.contactEmail,
      address: previous.address,
    });
    return profileSaved;
  }

  return { ok: true };
}

async function withIssuedAccounts(organizations: OrganizationListItem[]): Promise<OrganizationListItem[]> {
  if (!process.env.SUPABASE_SECRET_KEY) return organizations;

  return Promise.all(
    organizations.map(async (organization) => ({
      ...organization,
      admins: await Promise.all(organization.admins.map((admin) => overlayIssuedAccount(admin))),
    })),
  );
}

async function issuedAccount(
  userId: string,
): Promise<{ accountId: string; firstName: string; lastName: string } | null> {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  const user = await createAdminClient().auth.admin.getUserById(userId);
  if (user.error || !user.data.user) return null;
  return readIssuedAccount(user.data.user.email, user.data.user.user_metadata);
}

async function overlayIssuedAccount(admin: OrganizationAdmin): Promise<OrganizationAdmin> {
  if (!process.env.SUPABASE_SECRET_KEY) return admin;
  const user = await createAdminClient().auth.admin.getUserById(admin.userId);
  if (user.error || !user.data.user) return admin;
  const issued = readIssuedAccount(user.data.user.email, user.data.user.user_metadata);
  return {
    userId: admin.userId,
    accountId: issued.accountId || admin.accountId,
    firstName: issued.firstName || admin.firstName,
    lastName: issued.lastName || admin.lastName,
  };
}

function readIssuedAccount(
  email: string | undefined,
  metadata: Record<string, unknown> | undefined,
): { accountId: string; firstName: string; lastName: string } {
  const firstName = typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
  const lastName = typeof metadata?.last_name === "string" ? metadata.last_name.trim() : "";
  return {
    accountId: accountIdFromEmail(email) ?? "",
    firstName,
    lastName,
  };
}

async function writeOrganizationRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  input: UpdateOrganizationInput,
): Promise<{ ok: true } | { ok: false; error: FormError }> {
  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name,
      slug: input.slug,
      contact_email: input.contactEmail.trim() || null,
      address: input.address.trim() || null,
    })
    .eq("id", input.organizationId);

  if (error) return { ok: false, error: mapWriteError(error) };

  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    organization_id: input.organizationId,
    action: "organization.update",
    metadata: {
      slug: input.slug,
      admin_user_id: input.adminUserId,
      admin_account_id: input.adminAccountId,
      password_reset: input.adminPassword.length > 0,
    },
  });

  return { ok: true };
}

async function writeOrganizationAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: UpdateOrganizationInput,
): Promise<{ ok: true } | { ok: false; error: FormError }> {
  const { error } = await supabase.rpc("update_organization_and_admin", {
    p_organization_id: input.organizationId,
    p_name: input.name,
    p_slug: input.slug,
    p_contact_email: input.contactEmail,
    p_address: input.address,
    p_admin_user_id: input.adminUserId,
    p_first_name: input.adminFirstName,
    p_last_name: input.adminLastName,
    p_account_id: input.adminAccountId,
  });

  if (error) return { ok: false, error: mapWriteError(error) };
  return { ok: true };
}
