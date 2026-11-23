import { isValidAccountId } from "@/lib/validation/account-id";

export const ACCOUNT_EMAIL_DOMAIN = "id.casineroom.app";

export function accountEmail(accountId: string): string {
  return `${accountId}@${ACCOUNT_EMAIL_DOMAIN}`;
}

export function accountIdFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const suffix = `@${ACCOUNT_EMAIL_DOMAIN}`;
  if (!email.toLowerCase().endsWith(suffix)) return null;
  const accountId = email.slice(0, -suffix.length).toLowerCase();
  return isValidAccountId(accountId) ? accountId : null;
}
