export function roleLabel(
  name: string | undefined,
  copy: { staff: string; ownerRole: string },
) {
  if (!name || name === "staff") return copy.staff;
  if (name === "organization_admin") return copy.ownerRole;
  return name;
}
