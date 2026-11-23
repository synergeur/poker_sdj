import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SessionHome } from "@/lib/tenant/access";
import { createClient } from "@/lib/supabase/server";
import { publicSupabaseEnv } from "@/lib/supabase/env";

type OrganizationEmbed = {
  slug?: string;
  name?: string;
  status?: string;
} | null;

export async function currentSessionHome(): Promise<SessionHome> {
  if (!publicSupabaseEnv()) return { kind: "anonymous" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { kind: "anonymous" };
    return lookupSessionHome(supabase, data.user.id);
  } catch {
    return { kind: "anonymous" };
  }
}

export async function lookupSessionHome(supabase: SupabaseClient, userId: string): Promise<SessionHome> {
  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!adminError && admin) return { kind: "host" };

  const { data: memberships, error } = await supabase
    .from("organization_members")
    .select("organizations(slug, status)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error || !memberships) return { kind: "none" };

  for (const membership of memberships as { organizations: OrganizationEmbed | OrganizationEmbed[] }[]) {
    const embedded = membership.organizations;
    const organization = Array.isArray(embedded) ? embedded[0] : embedded;
    if (organization?.status === "active" && organization.slug) {
      return { kind: "organization", slug: organization.slug };
    }
  }

  return { kind: "none" };
}

export async function organizationBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("name, slug, status")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data?.name || !data.slug) return null;
  return { name: data.name as string, slug: data.slug as string, status: data.status as string };
}
