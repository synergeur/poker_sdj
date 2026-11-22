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

export function buildApexSignInUrl(requestUrl: string, rootDomain: string, appUrl?: string): URL {
  if (appUrl) {
    const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
    return new URL("sign-in", base);
  }

  const url = new URL(requestUrl);
  const [domain, port] = rootDomain.trim().toLowerCase().split(":");
  url.hostname = domain || url.hostname;
  if (port) {
    url.port = port;
  }
  url.pathname = "/sign-in";
  url.search = "";
  url.hash = "";
  return url;
}
