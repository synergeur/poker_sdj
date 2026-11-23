export function organizationLinks(input: {
  home: string;
  mine: string;
  employees: string;
  accounts: string;
  scopes: string;
  current: "home" | "me" | "employees" | "accounts" | "scopes";
  self: boolean;
  manageEmployees: boolean;
  manageAccounts: boolean;
  manageScopes: boolean;
}) {
  const links = [{ href: "/home", label: input.home, current: input.current === "home" }];
  if (input.manageEmployees) {
    links.push({ href: "/employees", label: input.employees, current: input.current === "employees" });
  }
  if (input.self) {
    links.push({ href: "/me", label: input.mine, current: input.current === "me" });
  }
  if (input.manageAccounts) {
    links.push({ href: "/accounts", label: input.accounts, current: input.current === "accounts" });
  }
  if (input.manageScopes) {
    links.push({ href: "/scopes", label: input.scopes, current: input.current === "scopes" });
  }
  return links;
}
