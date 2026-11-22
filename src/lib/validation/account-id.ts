const ACCOUNT_ID_PATTERN = /^[a-z][a-z0-9_]{2,31}$/;

export function normalizeAccountId(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidAccountId(value: string): boolean {
  return ACCOUNT_ID_PATTERN.test(value);
}
