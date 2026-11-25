export const SCOPE_MANAGER = "scope_manager";
export const ACCOUNTS = "accounts";
export const EMPLOYEES = "employees";
export const BADBEAT_ENTRY = "badbeat_entry";
export const BADBEAT_STATS = "badbeat_stats";
export const SCHEDULE = "schedule";
export const CASHIER = "cashier";

const OWNER_SCOPES = [ACCOUNTS, BADBEAT_ENTRY, BADBEAT_STATS, CASHIER, EMPLOYEES, SCHEDULE, SCOPE_MANAGER];

export function effectiveScopes(input: {
  isOwner: boolean;
  roleScopes: readonly string[];
  extraScopes: readonly string[];
}): string[] {
  const scopes = new Set<string>([...input.roleScopes, ...input.extraScopes]);
  if (input.isOwner) {
    for (const scope of OWNER_SCOPES) scopes.add(scope);
  }
  return [...scopes].sort();
}

export function hasEffectiveScope(
  input: {
    isOwner: boolean;
    roleScopes: readonly string[];
    extraScopes: readonly string[];
  },
  scope: string,
): boolean {
  return effectiveScopes(input).includes(scope);
}

export function hasScopeManager(input: {
  isOwner: boolean;
  roleScopes: readonly string[];
  extraScopes: readonly string[];
}): boolean {
  return hasEffectiveScope(input, SCOPE_MANAGER);
}
