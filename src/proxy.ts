import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { appUrl, publicSupabaseEnv, rootDomain } from "@/lib/supabase/env";
import { sharedCookieOptions } from "@/lib/supabase/cookies";
import { crossHostHomeUrl } from "@/lib/auth/handoff";
import { decideAccess, type SessionHome } from "@/lib/tenant/access";
import { ORGANIZATION_HOST_HEADER, parseRequestHost } from "@/lib/tenant/host";
import { lookupSessionHome } from "@/server/authorization/session-home";

export async function proxy(request: NextRequest) {
  const domain = rootDomain();
  const parsed = parseRequestHost(request.headers.get("host") ?? "", domain);
  const slug = parsed.kind === "tenant" ? parsed.slug : null;
  const env = publicSupabaseEnv();

  if (!env) {
    return finish(request, forward(request, slug), { kind: "anonymous" }, domain);
  }

  let sessionResponse = forward(request, slug);
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        sessionResponse = forward(request, slug);
        cookiesToSet.forEach(({ name, value, options }) => {
          sessionResponse.cookies.set(name, value, sharedCookieOptions(options));
        });
        Object.entries(headers).forEach(([key, value]) => {
          sessionResponse.headers.set(key, value);
        });
      },
    },
  });

  let home: SessionHome = { kind: "anonymous" };
  try {
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (typeof userId === "string" && userId.length > 0) {
      home = await lookupSessionHome(supabase, userId);
    }
  } catch {
    home = { kind: "anonymous" };
  }

  return finish(request, sessionResponse, home, domain);
}

function finish(request: NextRequest, sessionResponse: NextResponse, home: SessionHome, domain: string) {
  const parsed = parseRequestHost(request.headers.get("host") ?? "", domain);
  const decision = decideAccess({
    host: parsed,
    pathname: request.nextUrl.pathname,
    home,
    rootDomain: domain,
    appUrl: appUrl() || request.nextUrl.origin,
  });

  if (decision.type === "allow") return sessionResponse;
  const href = crossHostHomeUrl(request.headers.get("host") ?? "", decision.href, request.cookies.getAll());
  return redirectPreserving(request, href, sessionResponse);
}

function forward(request: NextRequest, slug: string | null) {
  const headers = new Headers(request.headers);
  if (slug) headers.set(ORGANIZATION_HOST_HEADER, slug);
  else headers.delete(ORGANIZATION_HOST_HEADER);

  const cookie = request.cookies
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  if (cookie) headers.set("cookie", cookie);
  else headers.delete("cookie");

  return NextResponse.next({ request: { headers } });
}

function redirectPreserving(request: NextRequest, href: string, sessionResponse: NextResponse) {
  const destination = new URL(href);
  const publicHost = parseRequestHost(request.headers.get("host") ?? "", rootDomain());
  const devRewroteTenantOntoApex =
    publicHost.kind === "tenant" && destination.origin === request.nextUrl.origin;

  if (devRewroteTenantOntoApex) {
    const target = destination.href;
    const safe = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safe}"><script>location.replace(${JSON.stringify(target)})</script></head><body></body></html>`;
    return carrySession(
      new NextResponse(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      }),
      sessionResponse,
    );
  }

  return carrySession(NextResponse.redirect(destination), sessionResponse);
}

function carrySession(response: NextResponse, sessionResponse: NextResponse) {
  const setCookies = sessionResponse.headers.getSetCookie();
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
    if (value) response.headers.set(header, value);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
