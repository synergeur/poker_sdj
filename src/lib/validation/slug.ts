export const RESERVED_SLUGS = ["www", "admin", "api", "app", "auth", "mail"] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SlugValidation = "ok" | "format" | "reserved";

export function validateSlug(slug: string): SlugValidation {
  if (slug.length < 2 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
    return "format";
  }

  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return "reserved";
  }

  return "ok";
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
