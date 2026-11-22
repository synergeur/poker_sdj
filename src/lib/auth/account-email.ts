export const ACCOUNT_EMAIL_DOMAIN = "id.casinoroom.app";

export function accountEmail(accountId: string): string {
  return `${accountId}@${ACCOUNT_EMAIL_DOMAIN}`;
}
