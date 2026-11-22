import "server-only";

import { accountEmail } from "@/lib/auth/account-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { FormError } from "@/lib/validation/organization";
import type { CreateOrganizationInput, OrganizationStatus } from "@/lib/validation/organization";

import { getAccess } from "@/server/authorization/platform-admin";

export type OrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  contactEmail: string | null;
  address: string | null;
  createdAt: string;
  adminAccountIds: string[];
};

type ProfileEmbed = { account_id: string } | { account_id: string }[] | null;

type MemberEmbed = {
  profiles: ProfileEmbed;
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

function accountIds(members: MemberEmbed[] | null): string[] {
  if (!members) return [];

  return members.flatMap((member) => {
    if (!member.profiles) return [];
    if (Array.isArray(member.profiles)) {
      return member.profiles.map((profile) => profile.account_id);
    }
    return [member.profiles.account_id];
  });
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
      "id, name, slug, status, contact_email, address, created_at, organization_members(profiles(account_id))",
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    return { ok: false, error: "failed" };
  }

  const organizations = (data as OrganizationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    contactEmail: row.contact_email,
    address: row.address,
    createdAt: row.created_at,
    adminAccountIds: accountIds(row.organization_members),
  }));

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
