import { NextResponse } from "next/server";

import { expiredAuthCookieHeaders } from "@/lib/auth/sign-out-cookies";
import { publicSupabaseEnv, rootDomain, appUrl } from "@/lib/supabase/env";
import { buildApexUrl, parseRequestHost } from "@/lib/tenant/host";

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const parsed = parseRequestHost(host, rootDomain());
  const destination =
    parsed.kind === "tenant"
      ? buildApexUrl("/auth/sign-out", rootDomain(), appUrl()).href
      : buildApexUrl("/sign-in", rootDomain(), appUrl()).href;

  await revokeSession(request.headers.get("cookie") ?? "");

  const response = crossHostResponse(request, destination);
  const domain = rootDomain().split(":")[0]?.trim().toLowerCase() ?? "";
  for (const header of expiredAuthCookieHeaders(request.headers.get("cookie") ?? "", domain)) {
    response.headers.append("Set-Cookie", header);
  }

  return response;
}

function crossHostResponse(request: Request, href: string) {
  const destination = new URL(href);
  const publicHost = request.headers.get("host") ?? "";

  if (destination.host === publicHost) {
    return NextResponse.redirect(destination);
  }

  const safe = href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><script>location.replace(${JSON.stringify(href)})</script></head><body></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function revokeSession(cookieHeader: string) {
  const env = publicSupabaseEnv();
  const accessToken = accessTokenFromCookies(cookieHeader);
  if (!env || !accessToken) return;

  await fetch(`${env.url}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${accessToken}`,
    },
  }).catch(() => undefined);
}

function accessTokenFromCookies(cookieHeader: string) {
  const values = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const raw = part.slice(index + 1).trim();
    try {
      values.set(part.slice(0, index).trim(), decodeURIComponent(raw));
    } catch {
      values.set(part.slice(0, index).trim(), raw);
    }
  }

  const names = [...values.keys()].filter((name) => name.startsWith("sb-") && name.includes("auth-token"));
  const base = names[0]?.replace(/\.\d+$/, "");
  if (!base) return null;

  const direct = values.get(base);
  const combined = direct || [0, 1, 2, 3, 4].map((index) => values.get(`${base}.${index}`) ?? "").join("");
  if (!combined) return null;

  const json = combined.startsWith("base64-")
    ? Buffer.from(combined.slice("base64-".length), "base64url").toString("utf8")
    : combined;

  try {
    const parsed = JSON.parse(json) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}
