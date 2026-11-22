import "server-only";

import { createClient } from "@/lib/supabase/server";
import { publicSupabaseEnv } from "@/lib/supabase/env";

export type Access =
  | { kind: "unconfigured" }
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { kind: "host"; userId: string };

export async function getAccess(): Promise<Access> {
  if (!publicSupabaseEnv()) {
    return { kind: "unconfigured" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { kind: "anonymous" };
    }

    const { data: admin, error: adminError } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return { kind: "forbidden" };
    }

    return { kind: "host", userId: data.user.id };
  } catch {
    return { kind: "unconfigured" };
  }
}
