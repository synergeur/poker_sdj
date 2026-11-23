export function expiredAuthCookieHeaders(cookieHeader: string, domain: string): string[] {
  const names = new Set<string>();

  for (const part of cookieHeader.split(";")) {
    const name = part.split("=")[0]?.trim() ?? "";
    if (!name.startsWith("sb-")) continue;
    const base = name.replace(/\.\d+$/, "");
    names.add(base);
    names.add(name);
    for (let index = 0; index < 5; index += 1) names.add(`${base}.${index}`);
  }

  const headers: string[] = [];
  for (const name of names) {
    headers.push(`${name}=; Path=/; Max-Age=0; SameSite=Lax`);
    if (domain) headers.push(`${name}=; Path=/; Domain=${domain}; Max-Age=0; SameSite=Lax`);
  }

  return headers;
}
