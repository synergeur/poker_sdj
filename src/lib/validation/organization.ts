import { z } from "zod";

import { isValidAccountId, normalizeAccountId } from "@/lib/validation/account-id";
import { validateSlug } from "@/lib/validation/slug";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const organizationStatuses = ["active", "suspended"] as const;

export type OrganizationStatus = (typeof organizationStatuses)[number];

export type FormError =
  | "invalid"
  | "slug_invalid"
  | "slug_reserved"
  | "slug_taken"
  | "account_invalid"
  | "account_taken"
  | "password_mismatch"
  | "password_short"
  | "forbidden"
  | "unavailable"
  | "failed"
  | "account_cleanup_failed"
  | "credentials";

const FORM_ERRORS = new Set<FormError>([
  "invalid",
  "slug_invalid",
  "slug_reserved",
  "slug_taken",
  "account_invalid",
  "account_taken",
  "password_mismatch",
  "password_short",
  "forbidden",
  "unavailable",
  "failed",
  "account_cleanup_failed",
  "credentials",
]);

export function isFormError(value: string): value is FormError {
  return FORM_ERRORS.has(value as FormError);
}

export const signInSchema = z.object({
  accountId: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidAccountId, { message: "account_invalid" }),
  password: z.string().min(1).max(72),
});

export const createOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase(),
    status: z.enum(organizationStatuses),
    contactEmail: z.string().trim().max(160),
    address: z.string().trim().max(240),
    adminFirstName: z.string().trim().min(1).max(80),
    adminLastName: z.string().trim().min(1).max(80),
    adminAccountId: z.string().trim().toLowerCase(),
    adminPassword: z.string().min(8).max(72),
    adminPasswordConfirm: z.string(),
  })
  .superRefine((value, context) => {
    const slugCheck = validateSlug(value.slug);
    if (slugCheck === "reserved") {
      context.addIssue({ code: "custom", path: ["slug"], message: "slug_reserved" });
    } else if (slugCheck !== "ok") {
      context.addIssue({ code: "custom", path: ["slug"], message: "slug_invalid" });
    }

    if (!isValidAccountId(value.adminAccountId)) {
      context.addIssue({
        code: "custom",
        path: ["adminAccountId"],
        message: "account_invalid",
      });
    }

    if (value.contactEmail && !EMAIL_PATTERN.test(value.contactEmail)) {
      context.addIssue({ code: "custom", path: ["contactEmail"], message: "invalid" });
    }

    if (value.adminPassword !== value.adminPasswordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["adminPasswordConfirm"],
        message: "password_mismatch",
      });
    }
  });

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const updateOrganizationSchema = z
  .object({
    organizationId: z.string().trim(),
    adminUserId: z.string().trim(),
    name: z.string().trim().min(2).max(120),
    slug: z.string().trim().toLowerCase(),
    contactEmail: z.string().trim().max(160),
    address: z.string().trim().max(240),
    adminFirstName: z.string().trim().min(1).max(80),
    adminLastName: z.string().trim().min(1).max(80),
    adminAccountId: z.string().trim().toLowerCase(),
    adminPassword: z.string().max(72),
    adminPasswordConfirm: z.string(),
  })
  .superRefine((value, context) => {
    if (!UUID_PATTERN.test(value.organizationId) || !UUID_PATTERN.test(value.adminUserId)) {
      context.addIssue({ code: "custom", path: ["organizationId"], message: "invalid" });
    }

    const slugCheck = validateSlug(value.slug);
    if (slugCheck === "reserved") {
      context.addIssue({ code: "custom", path: ["slug"], message: "slug_reserved" });
    } else if (slugCheck !== "ok") {
      context.addIssue({ code: "custom", path: ["slug"], message: "slug_invalid" });
    }

    if (!isValidAccountId(value.adminAccountId)) {
      context.addIssue({
        code: "custom",
        path: ["adminAccountId"],
        message: "account_invalid",
      });
    }

    if (value.contactEmail && !EMAIL_PATTERN.test(value.contactEmail)) {
      context.addIssue({ code: "custom", path: ["contactEmail"], message: "invalid" });
    }

    const password = value.adminPassword;
    const confirm = value.adminPasswordConfirm;
    if (!password && !confirm) return;

    if (password !== confirm) {
      context.addIssue({
        code: "custom",
        path: ["adminPasswordConfirm"],
        message: "password_mismatch",
      });
      return;
    }

    if (password.length < 8) {
      context.addIssue({
        code: "custom",
        path: ["adminPassword"],
        message: "password_short",
      });
    }
  });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export function parseSignIn(input: { accountId: unknown; password: unknown }) {
  const parsed = signInSchema.safeParse({
    accountId: typeof input.accountId === "string" ? normalizeAccountId(input.accountId) : "",
    password: typeof input.password === "string" ? input.password : "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return {
      ok: false as const,
      error: message && isFormError(message) ? message : ("invalid" as const),
    };
  }

  return { ok: true as const, data: parsed.data };
}

export function parseCreateOrganization(input: {
  name: unknown;
  slug: unknown;
  status: unknown;
  contactEmail: unknown;
  address: unknown;
  adminFirstName: unknown;
  adminLastName: unknown;
  adminAccountId: unknown;
  adminPassword: unknown;
  adminPasswordConfirm: unknown;
}) {
  const parsed = createOrganizationSchema.safeParse({
    ...input,
    adminAccountId:
      typeof input.adminAccountId === "string"
        ? normalizeAccountId(input.adminAccountId)
        : input.adminAccountId,
    slug: typeof input.slug === "string" ? input.slug.trim().toLowerCase() : input.slug,
  });

  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find((issue) => issue.path[0] === "adminPassword");
    if (passwordIssue?.code === "too_small") {
      return { ok: false as const, error: "password_short" as const };
    }

    const message = parsed.error.issues[0]?.message;
    return {
      ok: false as const,
      error: message && isFormError(message) ? message : ("invalid" as const),
    };
  }

  return { ok: true as const, data: parsed.data };
}

export function parseUpdateOrganization(input: {
  organizationId: unknown;
  adminUserId: unknown;
  name: unknown;
  slug: unknown;
  contactEmail: unknown;
  address: unknown;
  adminFirstName: unknown;
  adminLastName: unknown;
  adminAccountId: unknown;
  adminPassword: unknown;
  adminPasswordConfirm: unknown;
}) {
  const parsed = updateOrganizationSchema.safeParse({
    ...input,
    adminAccountId:
      typeof input.adminAccountId === "string"
        ? normalizeAccountId(input.adminAccountId)
        : input.adminAccountId,
    slug: typeof input.slug === "string" ? input.slug.trim().toLowerCase() : input.slug,
    adminPassword: typeof input.adminPassword === "string" ? input.adminPassword : "",
    adminPasswordConfirm:
      typeof input.adminPasswordConfirm === "string" ? input.adminPasswordConfirm : "",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message;
    return {
      ok: false as const,
      error: message && isFormError(message) ? message : ("invalid" as const),
    };
  }

  return { ok: true as const, data: parsed.data };
}
