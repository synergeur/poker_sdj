import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { appUrl, publicSupabaseEnv, rootDomain } from "@/lib/supabase/env";
import { buildApexSignInUrl, parseRequestHost } from "@/lib/tenant/host";

export async function proxy(request: NextRequest) {
  const parsed = parseRequestHost(request.headers.get("host") ?? "", rootDomain());

  if (parsed.kind === "tenant") {
    return redirectTenantToApex(request);
  }

  const env = publicSupabaseEnv();
  if (!env) {
    return redirectSignedOut(request, NextResponse.next({ request }));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = typeof data?.claims?.sub === "string" && data.claims.sub.length > 0;
  } catch {
    signedIn = false;
  }

  return redirectSignedOut(request, supabaseResponse, signedIn);
}

function redirectTenantToApex(request: NextRequest) {
  const publicUrl = `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}${request.nextUrl.pathname}`;
  const destination = buildApexSignInUrl(publicUrl, rootDomain(), appUrl());

  // The dev server rewrites the internal URL to the apex before Proxy runs, then
  // turns a same-origin Location into a relative path. A relative /sign-in would
  // keep the browser on the organization host.
  if (destination.origin === request.nextUrl.origin) {
    const target = destination.href;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${target}"><script>location.replace(${JSON.stringify(target)})</script></head><body></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.redirect(destination);
}

function redirectSignedOut(request: NextRequest, sessionResponse: NextResponse, signedIn = false) {
  const path = request.nextUrl.pathname;
  const needsSignIn = path === "/" || path.startsWith("/admin");
  const leavingSignIn = signedIn && (path === "/sign-in" || path === "/");

  if (!signedIn && needsSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    return carrySession(NextResponse.redirect(url), sessionResponse);
  }

  if (leavingSignIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return carrySession(NextResponse.redirect(url), sessionResponse);
  }

  return sessionResponse;
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
