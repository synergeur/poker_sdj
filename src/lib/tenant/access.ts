import { buildApexUrl, buildTenantUrl, type ParsedHost, type RequestSite } from "@/lib/tenant/host";

export type SessionHome =
  | { kind: "anonymous" }
  | { kind: "none" }
  | { kind: "host" }
  | { kind: "organization"; slug: string };

export type AccessDecision = { type: "allow" } | { type: "redirect"; href: string };

export function decideAccess(input: {
  host: ParsedHost;
  pathname: string;
  home: SessionHome;
  site: RequestSite;
}): AccessDecision {
  const pathname = normalizePath(input.pathname);
  const apex = (path: string) => buildApexUrl(path, input.site).href;
  const tenant = (slug: string, path = "/home") => buildTenantUrl(slug, path, input.site).href;

  if (input.host.kind === "apex") {
    return decideApex(pathname, input.home, apex, tenant);
  }

  return decideTenant(pathname, input.host.slug, input.home, apex, tenant);
}

function decideApex(
  pathname: string,
  home: SessionHome,
  apex: (path: string) => string,
  tenant: (slug: string, path?: string) => string,
): AccessDecision {
  if (pathname === "/auth/handoff" || pathname === "/auth/sign-out") return { type: "allow" };

  if (
    pathname === "/scopes" ||
    pathname === "/accounts" ||
    pathname === "/employees" ||
    pathname === "/me" ||
    pathname === "/badbeat" ||
    pathname === "/promotions" ||
    pathname === "/schedule" ||
    pathname === "/dev"
  ) {
    if (home.kind === "organization") return { type: "redirect", href: tenant(home.slug, pathname) };
    if (home.kind === "host") return { type: "redirect", href: apex("/admin") };
    return { type: "redirect", href: apex("/sign-in") };
  }

  if (pathname === "/" || pathname === "/sign-in" || pathname === "/home") {
    return redirectHome(home, apex, tenant) ?? (pathname === "/" || pathname === "/home"
      ? { type: "redirect", href: apex("/sign-in") }
      : { type: "allow" });
  }

  if (isAdminPath(pathname)) {
    if (home.kind === "anonymous") return { type: "redirect", href: apex("/sign-in") };
    if (home.kind === "organization") return { type: "redirect", href: tenant(home.slug) };
    return { type: "allow" };
  }

  return { type: "allow" };
}

function decideTenant(
  pathname: string,
  slug: string,
  home: SessionHome,
  apex: (path: string) => string,
  tenant: (slug: string, path?: string) => string,
): AccessDecision {
  if (pathname === "/auth/handoff" || pathname === "/auth/sign-out") return { type: "allow" };

  const ownsThisOrganization = home.kind === "organization" && home.slug === slug;
  const platformHost = home.kind === "host";

  if (!ownsThisOrganization && !platformHost) {
    if (home.kind === "organization") return { type: "redirect", href: tenant(home.slug) };
    return { type: "redirect", href: apex("/sign-in") };
  }

  if (pathname === "/" || pathname === "/sign-in") {
    return { type: "redirect", href: tenant(slug) };
  }

  if (isAdminPath(pathname)) {
    if (platformHost) return { type: "redirect", href: apex("/admin") };
    return { type: "redirect", href: tenant(slug) };
  }

  return { type: "allow" };
}

function redirectHome(
  home: SessionHome,
  apex: (path: string) => string,
  tenant: (slug: string, path?: string) => string,
): AccessDecision | null {
  if (home.kind === "host") return { type: "redirect", href: apex("/admin") };
  if (home.kind === "organization") return { type: "redirect", href: tenant(home.slug) };
  return null;
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname || "/";
}
