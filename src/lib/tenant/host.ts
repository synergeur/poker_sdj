export const ORGANIZATION_HOST_HEADER = "x-organization-slug";

export type ParsedHost = { kind: "apex" } | { kind: "tenant"; slug: string };

function hostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function parseRequestHost(hostHeader: string, rootDomain: string): ParsedHost {
  const host = hostname(hostHeader);
  const root = hostname(rootDomain);

  if (!host || !root || host === root || host === `www.${root}`) {
    return { kind: "apex" };
  }

  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) {
    return { kind: "apex" };
  }

  const slug = host.slice(0, -suffix.length);
  if (!slug || slug === "www") {
    return { kind: "apex" };
  }

  return { kind: "tenant", slug };
}

export function buildApexUrl(pathname: string, rootDomain: string, appUrl?: string): URL {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (appUrl) {
    const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
    return new URL(path.slice(1), base);
  }

  const root = hostname(rootDomain) || "localhost";
  const port = rootDomain.trim().split(":")[1];
  const url = new URL(`http://${root}${path}`);
  if (port) url.port = port;
  return url;
}

export function buildTenantUrl(slug: string, pathname: string, rootDomain: string, appUrl?: string): URL {
  const url = buildApexUrl(pathname, rootDomain, appUrl);
  const root = hostname(rootDomain) || url.hostname;
  url.hostname = `${slug}.${root}`;
  return url;
}

export function buildApexSignInUrl(requestUrl: string, rootDomain: string, appUrl?: string): URL {
  const url = buildApexUrl("/sign-in", rootDomain, appUrl);
  if (!appUrl) {
    const request = new URL(requestUrl);
    if (request.port) url.port = request.port;
  }
  return url;
}
