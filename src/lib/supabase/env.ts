export function publicSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function rootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";
}

export function appUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_APP_URL || undefined;
}
