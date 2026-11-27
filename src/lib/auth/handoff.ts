import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { buildTenantUrl, type RequestSite } from "@/lib/tenant/host";

const TTL_MS = 60_000;

type HandoffPayload = {
  exp: number;
  cookies: { name: string; value: string }[];
};

export function isAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("auth-token");
}

export function sealHandoff(cookies: { name: string; value: string }[]): string {
  const authCookies = cookies.filter((cookie) => isAuthCookie(cookie.name) && cookie.value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", handoffKey(), iv);
  const payload: HandoffPayload = { exp: Date.now() + TTL_MS, cookies: authCookies };
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function openHandoff(token: string): { name: string; value: string }[] | null {
  try {
    const bytes = Buffer.from(token, "base64url");
    const iv = bytes.subarray(0, 12);
    const tag = bytes.subarray(12, 28);
    const encrypted = bytes.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", handoffKey(), iv);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as HandoffPayload;
    if (!payload || payload.exp < Date.now() || !Array.isArray(payload.cookies)) return null;
    return payload.cookies.filter((cookie) => isAuthCookie(cookie.name) && typeof cookie.value === "string");
  } catch {
    return null;
  }
}

const HANDOFF_PATHS = new Set(["/home", "/scopes", "/accounts", "/employees", "/me", "/badbeat", "/promotions", "/schedule", "/dev", "/admin"]);

export function handoffDestination(nextPath: string | null) {
  if (nextPath && nextPath !== "/home" && HANDOFF_PATHS.has(nextPath)) return nextPath;
  return "/home";
}

export function organizationHandoffUrl(
  slug: string,
  cookies: { name: string; value: string }[],
  site: RequestSite,
  nextPath = "/home",
) {
  const url = buildTenantUrl(slug, "/auth/handoff", site);
  url.searchParams.set("token", sealHandoff(cookies));
  if (nextPath !== "/home" && HANDOFF_PATHS.has(nextPath)) url.searchParams.set("next", nextPath);
  return url.href;
}

export function crossHostHomeUrl(requestHost: string, href: string, cookies: { name: string; value: string }[]) {
  const destination = new URL(href);
  if (!HANDOFF_PATHS.has(destination.pathname) || destination.host === requestHost) return href;
  const authCookies = cookies.filter((cookie) => isAuthCookie(cookie.name) && cookie.value);
  if (authCookies.length === 0) return href;

  const nextPath = destination.pathname;
  destination.pathname = "/auth/handoff";
  destination.search = "";
  destination.searchParams.set("token", sealHandoff(authCookies));
  if (nextPath !== "/home") destination.searchParams.set("next", nextPath);
  return destination.href;
}

function handoffKey() {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL || "casino-room-handoff";
  return createHash("sha256").update(secret).digest();
}
