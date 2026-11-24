export const ORGANIZATION_HOST_HEADER = "x-organization-slug";

export type ParsedHost = { kind: "apex" } | { kind: "tenant"; slug: string };

export type RequestSite = {
  protocol: "http" | "https";
  rootDomain: string;
  port: string;
  host: ParsedHost;
};

const MULTI_PART_SUFFIXES = [
  "ac.uk",
  "co.id",
  "co.in",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.uk",
  "co.za",
  "com.ar",
  "com.au",
  "com.br",
  "com.cn",
  "com.co",
  "com.hk",
  "com.mx",
  "com.pe",
  "com.sg",
  "com.tr",
  "com.tw",
  "com.uy",
  "edu.au",
  "gov.au",
  "gov.uk",
  "govt.nz",
  "ltd.uk",
  "me.uk",
  "net.au",
  "net.nz",
  "net.uk",
  "org.au",
  "org.nz",
  "org.uk",
  "plc.uk",
  "azurewebsites.net",
  "fly.dev",
  "github.io",
  "herokuapp.com",
  "netlify.app",
  "onrender.com",
  "pages.dev",
  "railway.app",
  "vercel.app",
  "workers.dev",
].sort((left, right) => right.length - left.length);

export function requestSite(hostHeader: string, forwardedProto?: string | null): RequestSite {
  const { hostname, port } = splitHost(hostHeader);
  const name = hostname || "localhost";
  const { rootDomain, slug } = splitRegistrable(name);
  return {
    protocol: protocolFor(name, forwardedProto),
    rootDomain,
    port,
    host: slug ? { kind: "tenant", slug } : { kind: "apex" },
  };
}

export function parseRequestHost(hostHeader: string): ParsedHost {
  return requestSite(hostHeader).host;
}

export function cookieDomain(site: RequestSite): string {
  return isIp(site.rootDomain) ? "" : site.rootDomain;
}

export function buildApexUrl(pathname: string, site: RequestSite): URL {
  return urlFor(site, site.rootDomain, pathname);
}

export function buildTenantUrl(slug: string, pathname: string, site: RequestSite): URL {
  return urlFor(site, `${slug}.${site.rootDomain}`, pathname);
}

export function buildApexSignInUrl(requestUrl: string): URL {
  const request = new URL(requestUrl);
  return buildApexUrl("/sign-in", requestSite(request.host, request.protocol.replace(":", "")));
}

function urlFor(site: RequestSite, hostname: string, pathname: string): URL {
  const url = new URL(`${site.protocol}://${formatHost(hostname)}`);
  const port = site.port;
  const defaultPort = site.protocol === "https" ? "443" : "80";
  if (port && port !== defaultPort) url.port = port;
  url.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return url;
}

function formatHost(hostname: string) {
  if (hostname.includes(":") && !hostname.startsWith("[")) return `[${hostname}]`;
  return hostname;
}

function protocolFor(hostname: string, forwardedProto?: string | null): "http" | "https" {
  const forwarded = forwardedProto?.split(",")[0]?.trim().replace(/:$/, "");
  if (forwarded === "http" || forwarded === "https") return forwarded;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || isIp(hostname)) return "http";
  return "https";
}

function splitHost(value: string): { hostname: string; port: string } {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    const hostname = end >= 0 ? trimmed.slice(1, end) : trimmed;
    const port = end >= 0 && trimmed[end + 1] === ":" ? trimmed.slice(end + 2) : "";
    return { hostname, port: /^\d+$/.test(port) ? port : "" };
  }

  const colon = trimmed.lastIndexOf(":");
  if (colon > -1 && /^\d+$/.test(trimmed.slice(colon + 1))) {
    return { hostname: trimmed.slice(0, colon), port: trimmed.slice(colon + 1) };
  }
  return { hostname: trimmed, port: "" };
}

function splitRegistrable(hostname: string): { rootDomain: string; slug: string | null } {
  if (!hostname || hostname === "localhost" || isIp(hostname)) {
    return { rootDomain: hostname || "localhost", slug: null };
  }

  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length);
    if (!slug || slug === "www" || slug.includes(".")) return { rootDomain: "localhost", slug: null };
    return { rootDomain: "localhost", slug };
  }

  const labels = hostname.split(".");
  const suffixCount = publicSuffixLabels(hostname);
  const rootCount = suffixCount + 1;
  if (labels.length <= rootCount) return { rootDomain: hostname, slug: null };

  let extra = labels.slice(0, labels.length - rootCount);
  const rootDomain = labels.slice(labels.length - rootCount).join(".");
  if (extra[0] === "www") extra = extra.slice(1);
  if (extra.length !== 1 || !extra[0]) return { rootDomain, slug: null };
  return { rootDomain, slug: extra[0] };
}

function publicSuffixLabels(hostname: string) {
  for (const suffix of MULTI_PART_SUFFIXES) {
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return suffix.split(".").length;
  }
  return 1;
}

function isIp(hostname: string) {
  if (hostname.includes(":")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}
