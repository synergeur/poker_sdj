import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { handoffDestination, openHandoff } from "@/lib/auth/handoff";
import { buildApexUrl, requestSite } from "@/lib/tenant/host";

const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const sessionCookies = token ? openHandoff(token) : null;
  const signIn = buildApexUrl("/sign-in", requestSite(request.headers.get("host") ?? "", request.headers.get("x-forwarded-proto"))).href;

  if (!sessionCookies || sessionCookies.length === 0) {
    return NextResponse.redirect(signIn);
  }

  const host = request.headers.get("host");
  if (!host) return NextResponse.redirect(signIn);

  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const destination = handoffDestination(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(`${protocol}://${host}${destination}`);
  const store = await cookies();

  for (const cookie of sessionCookies) {
    const options = {
      path: "/",
      sameSite: "lax" as const,
      httpOnly: false,
      maxAge: COOKIE_MAX_AGE,
    };
    store.set(cookie.name, cookie.value, options);
    response.cookies.set(cookie.name, cookie.value, options);
  }

  return response;
}
