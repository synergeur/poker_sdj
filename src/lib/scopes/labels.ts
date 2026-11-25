const HIDDEN_ROLES = new Set(["staff", "organization_admin"]);

export function visibleRoleName(name: string | null | undefined) {
  if (!name || HIDDEN_ROLES.has(name)) return null;
  return name;
}

export function roleLabel(
  name: string | undefined,
  copy: { staff: string; ownerRole: string },
) {
  if (!name || name === "staff") return copy.staff;
  if (name === "organization_admin") return copy.ownerRole;
  return name;
}
