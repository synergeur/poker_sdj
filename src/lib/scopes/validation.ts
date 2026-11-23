import { z } from "zod";

import { isValidAccountId, normalizeAccountId } from "@/lib/validation/account-id";

const RESERVED_ROLE_NAMES = new Set(["organization_admin", "staff"]);

export type ScopeFormError =
  | "invalid"
  | "forbidden"
  | "unavailable"
  | "failed"
  | "account_invalid"
  | "account_taken"
  | "password_short"
  | "password_mismatch"
  | "role_invalid"
  | "role_taken"
  | "role_in_use"
  | "owner_locked"
  | "not_found";

const ERRORS = new Set<ScopeFormError>([
  "invalid",
  "forbidden",
  "unavailable",
  "failed",
  "account_invalid",
  "account_taken",
  "password_short",
  "password_mismatch",
  "role_invalid",
  "role_taken",
  "role_in_use",
  "owner_locked",
  "not_found",
]);

export function isScopeFormError(value: string): value is ScopeFormError {
  return ERRORS.has(value as ScopeFormError);
}

export function parseRoleName(value: unknown): { ok: true; name: string } | { ok: false; error: ScopeFormError } {
  const name = typeof value === "string" ? value.trim() : "";
  if (name.length < 2 || name.length > 40) return { ok: false, error: "role_invalid" };
  if (RESERVED_ROLE_NAMES.has(name.toLowerCase())) return { ok: false, error: "role_invalid" };
  return { ok: true, name };
}

function scopesFrom(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(list.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

const employeeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    accountId: z.string().trim().toLowerCase(),
    password: z.string().min(8).max(72),
    passwordConfirm: z.string(),
    roleId: z.string().uuid(),
    scopes: z.array(z.string()),
  })
  .superRefine((value, context) => {
    if (!isValidAccountId(value.accountId)) {
      context.addIssue({ code: "custom", path: ["accountId"], message: "account_invalid" });
    }
    if (value.password !== value.passwordConfirm) {
      context.addIssue({ code: "custom", path: ["passwordConfirm"], message: "password_mismatch" });
    }
  });

export function parseCreateEmployee(input: {
  firstName: unknown;
  lastName: unknown;
  accountId: unknown;
  password: unknown;
  passwordConfirm: unknown;
  roleId: unknown;
  scopes: unknown;
}) {
  const parsed = employeeSchema.safeParse({
    ...input,
    accountId: typeof input.accountId === "string" ? normalizeAccountId(input.accountId) : "",
    scopes: scopesFrom(input.scopes),
  });
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "password");
    if (passwordIssue?.code === "too_small") return { ok: false as const, error: "password_short" as const };
    const message = parsed.error.issues[0]?.message;
    return {
      ok: false as const,
      error: message && isScopeFormError(message) ? message : ("invalid" as const),
    };
  }
  return { ok: true as const, data: parsed.data };
}

const roleSchema = z.object({
  roleId: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().trim().max(240),
  scopes: z.array(z.string()),
});

export function parseRole(input: {
  roleId?: unknown;
  name: unknown;
  description: unknown;
  scopes: unknown;
}) {
  const parsed = roleSchema.safeParse({
    roleId: typeof input.roleId === "string" && input.roleId ? input.roleId : undefined,
    name: input.name,
    description: typeof input.description === "string" ? input.description : "",
    scopes: scopesFrom(input.scopes),
  });
  if (!parsed.success) return { ok: false as const, error: "invalid" as const };
  const name = parseRoleName(parsed.data.name);
  if (!name.ok) return name;
  return { ok: true as const, data: { ...parsed.data, name: name.name } };
}

export function parseMemberAccess(input: {
  userId: unknown;
  roleId: unknown;
  status: unknown;
  scopes: unknown;
  password: unknown;
  passwordConfirm: unknown;
}) {
  const userId = typeof input.userId === "string" ? input.userId : "";
  const roleId = typeof input.roleId === "string" ? input.roleId : "";
  const status = input.status === "disabled" ? "disabled" : input.status === "active" ? "active" : "";
  const password = typeof input.password === "string" ? input.password : "";
  const passwordConfirm = typeof input.passwordConfirm === "string" ? input.passwordConfirm : "";
  if (!z.string().uuid().safeParse(userId).success || !z.string().uuid().safeParse(roleId).success || !status) {
    return { ok: false as const, error: "invalid" as const };
  }
  if (password || passwordConfirm) {
    if (password !== passwordConfirm) return { ok: false as const, error: "password_mismatch" as const };
    if (password.length < 8 || password.length > 72) return { ok: false as const, error: "password_short" as const };
  }
  return {
    ok: true as const,
    data: { userId, roleId, status: status as "active" | "disabled", scopes: scopesFrom(input.scopes), password },
  };
}
