export type NavId =
  | "overview"
  | "open-close"
  | "gaming-floor"
  | "dealer-rotation"
  | "tournaments"
  | "cashier"
  | "supervisor-logbook"
  | "incidents"
  | "employees"
  | "me"
  | "schedule"
  | "time-attendance"
  | "requests"
  | "training"
  | "tasks"
  | "announcements"
  | "knowledge-base"
  | "inventory"
  | "badbeat"
  | "statistics"
  | "reports"
  | "accounts"
  | "scopes"
  | "audit-logs"
  | "organization-settings";

export type NavAccess = {
  self: boolean;
  employees: boolean;
  badbeat: boolean;
  schedule: boolean;
  accounts: boolean;
  scopes: boolean;
};

export type NavItem = {
  id: NavId;
  href: string;
  label: string;
  dev: boolean;
  current: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

type NavLabels = {
  overview: string;
  groups: {
    me: string;
    operations: string;
    workforce: string;
    management: string;
    analytics: string;
    administration: string;
  };
  items: Record<Exclude<NavId, "overview">, string>;
};

const DEV = new Set<NavId>([
  "open-close",
  "gaming-floor",
  "dealer-rotation",
  "tournaments",
  "cashier",
  "supervisor-logbook",
  "incidents",
  "time-attendance",
  "requests",
  "training",
  "tasks",
  "announcements",
  "knowledge-base",
  "inventory",
  "statistics",
  "reports",
  "audit-logs",
  "organization-settings",
]);

export function shellNav(
  current: NavId,
  access: {
    self: boolean;
    employees: boolean;
    badbeatEntry: boolean;
    badbeatStats: boolean;
    schedule: boolean;
    accounts: boolean;
    scopes: boolean;
  },
): { current: NavId; access: NavAccess } {
  return {
    current,
    access: {
      self: access.self,
      employees: access.employees,
      badbeat: access.badbeatEntry || access.badbeatStats,
      schedule: access.schedule,
      accounts: access.accounts,
      scopes: access.scopes,
    },
  };
}

export function buildOrganizationNav(input: {
  current: NavId | null;
  access: NavAccess;
  labels: NavLabels;
  showDev?: boolean;
}): { overview: NavItem; sections: NavSection[] } {
  const item = (id: Exclude<NavId, "overview">, href: string, visible = true): NavItem | null => {
    if (!visible) return null;
    const dev = DEV.has(id);
    return {
      id,
      href: dev ? `/dev?section=${id}` : href,
      label: input.labels.items[id],
      dev,
      current: input.current === id,
    };
  };

  const showDev = input.showDev ?? false;
  const sections: Array<{ id: keyof NavLabels["groups"]; items: Array<NavItem | null> }> = [
    {
      id: "me",
      items: [item("me", "/me", input.access.self)],
    },
    {
      id: "operations",
      items: [
        item("open-close", ""),
        item("gaming-floor", ""),
        item("dealer-rotation", ""),
        item("tournaments", ""),
        item("cashier", ""),
        item("supervisor-logbook", ""),
        item("incidents", ""),
      ],
    },
    {
      id: "workforce",
      items: [
        item("employees", "/employees", input.access.employees),
        item("schedule", "/schedule", input.access.schedule),
        item("time-attendance", ""),
        item("requests", ""),
        item("training", ""),
      ],
    },
    {
      id: "management",
      items: [item("tasks", ""), item("announcements", ""), item("knowledge-base", ""), item("inventory", "")],
    },
    {
      id: "analytics",
      items: [item("badbeat", "/badbeat", input.access.badbeat), item("statistics", ""), item("reports", "")],
    },
    {
      id: "administration",
      items: [
        item("accounts", "/accounts", input.access.accounts),
        item("scopes", "/scopes", input.access.scopes),
        item("audit-logs", ""),
        item("organization-settings", ""),
      ],
    },
  ];

  return {
    overview: {
      id: "overview",
      href: "/home",
      label: input.labels.overview,
      dev: false,
      current: input.current === "overview",
    },
    sections: sections
      .map((section) => ({
        id: section.id,
        label: input.labels.groups[section.id],
        items: section.items.filter((entry): entry is NavItem => entry !== null && (showDev || !entry.dev)),
      }))
      .filter((section) => section.items.length > 0),
  };
}

export function devSection(value: string | undefined): Exclude<NavId, "overview"> | null {
  if (!value || value === "overview" || !DEV.has(value as NavId)) return null;
  return value as Exclude<NavId, "overview">;
}
