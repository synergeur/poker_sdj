"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CircleUser,
  Clock,
  Coins,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  House,
  Inbox,
  KeyRound,
  LayoutGrid,
  Library,
  ListChecks,
  LogOut,
  Megaphone,
  Package,
  RefreshCcw,
  ScrollText,
  Settings,
  Shield,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { SettingsDialog } from "@/components/admin/settings-dialog";
import { BrandMark } from "@/components/brand-mark";
import { isLanguageShortcut, isTypingTarget } from "@/components/language-switcher";
import { isLocale, type Locale } from "@/i18n/locale";
import { buildOrganizationNav, type NavAccess, type NavId, type NavItem } from "@/lib/organization/links";
import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/locale";

const SIDEBAR_KEY = "casino-room-sidebar-collapsed";
const SHOW_DEV_KEY = "casino-room-show-dev";

export function OrganizationShell({
  brand,
  eyebrow,
  title,
  signOutHref,
  signOutLabel,
  nav,
  children,
}: {
  brand: string;
  eyebrow: string;
  title: string;
  signOutHref: string;
  signOutLabel: string;
  nav: { current: NavId | null; access: NavAccess };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const translations = useTranslations();
  const localeValue = useLocale();
  const locale: Locale = isLocale(localeValue) ? localeValue : "fr";
  const [collapsed, setCollapsed] = useState(false);
  const [showDev, setShowDevState] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = {
    title: translations("settings.title"),
    close: translations("settings.close"),
    language: translations("settings.language"),
    languageLabel: translations("language.label"),
    english: translations("language.en"),
    french: translations("language.fr"),
    shortcuts: translations("settings.shortcuts"),
    sidebarShortcut: translations("settings.sidebarShortcut"),
    sidebarKeys: translations("settings.sidebarKeys"),
    languageShortcut: translations("settings.languageShortcut"),
    languageKeys: translations("settings.languageKeys"),
  };

  function setSidebar(next: boolean | ((current: boolean) => boolean)) {
    setCollapsed((current) => {
      const value = typeof next === "function" ? next(current) : next;
      window.localStorage.setItem(SIDEBAR_KEY, value ? "1" : "0");
      return value;
    });
  }

  function setShowDev(next: boolean) {
    setShowDevState(next);
    window.localStorage.setItem(SHOW_DEV_KEY, next ? "1" : "0");
  }

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    setShowDevState(window.localStorage.getItem(SHOW_DEV_KEY) === "1");
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.ctrlKey || event.altKey || event.metaKey || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        setSidebar((current) => !current);
      }
      if (isLanguageShortcut(event)) {
        event.preventDefault();
        void setLocale(locale === "fr" ? "en" : "fr").then(() => router.refresh());
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locale, router]);

  const wide = !collapsed;
  const menu = buildOrganizationNav({
    current: nav.current,
    access: nav.access,
    showDev,
    labels: {
      overview: translations("nav.overview"),
      groups: {
        me: translations("nav.groups.me"),
        operations: translations("nav.groups.operations"),
        workforce: translations("nav.groups.workforce"),
        management: translations("nav.groups.management"),
        analytics: translations("nav.groups.analytics"),
        administration: translations("nav.groups.administration"),
      },
      items: {
        "open-close": translations("nav.items.open-close"),
        "gaming-floor": translations("nav.items.gaming-floor"),
        "dealer-rotation": translations("nav.items.dealer-rotation"),
        tournaments: translations("nav.items.tournaments"),
        cashier: translations("nav.items.cashier"),
        "supervisor-logbook": translations("nav.items.supervisor-logbook"),
        incidents: translations("nav.items.incidents"),
        employees: translations("nav.items.employees"),
        me: translations("nav.items.me"),
        schedule: translations("nav.items.schedule"),
        "time-attendance": translations("nav.items.time-attendance"),
        requests: translations("nav.items.requests"),
        training: translations("nav.items.training"),
        tasks: translations("nav.items.tasks"),
        announcements: translations("nav.items.announcements"),
        "knowledge-base": translations("nav.items.knowledge-base"),
        inventory: translations("nav.items.inventory"),
        badbeat: translations("nav.items.badbeat"),
        statistics: translations("nav.items.statistics"),
        reports: translations("nav.items.reports"),
        accounts: translations("nav.items.accounts"),
        scopes: translations("nav.items.scopes"),
        "audit-logs": translations("nav.items.audit-logs"),
        "organization-settings": translations("nav.items.organization-settings"),
      },
    },
  });

  return (
    <div className="flex h-dvh overflow-hidden text-violet-50">
      <aside
        className={cn(
          "flex h-full w-[4.75rem] shrink-0 flex-col border-r border-violet-200/10 bg-[#120a22]",
          wide && "md:w-60",
        )}
      >
        <div className={cn("flex flex-col items-center gap-3 px-2 py-4", wide && "md:items-stretch md:px-4")}>
          <div className={cn("flex justify-center", wide && "md:justify-start")}>
            <BrandMark name={brand} compact />
          </div>
          <h1 className="sr-only">{title}</h1>
          <div className={cn("hidden min-w-0", wide && "md:block")}>
            <p className="text-[10px] tracking-[0.14em] text-violet-200/55 uppercase">{eyebrow}</p>
            <p aria-hidden="true" className="truncate font-display text-lg font-semibold text-white">
              {title}
            </p>
          </div>
        </div>
        <div className={cn("px-2 pb-2", wide && "md:px-3")}>
          <button
            type="button"
            role="switch"
            aria-checked={showDev}
            title={translations("nav.showDev")}
            onClick={() => setShowDev(!showDev)}
            className={cn(
              "flex w-full items-center justify-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold",
              wide && "md:justify-start md:px-3",
              showDev ? "bg-rose-500/15 text-rose-200" : "text-violet-100/70 hover:bg-white/5 hover:text-white",
            )}
          >
            {showDev ? <Eye size={18} /> : <EyeOff size={18} />}
            <span className={cn("sr-only", wide && "md:not-sr-only")}>{translations("nav.showDev")}</span>
          </button>
        </div>
        <nav className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2", wide && "md:px-3")}>
          <NavLink item={menu.overview} wide={wide} />
          {menu.sections.map((section) => (
            <div key={section.id} className="mt-3">
              <p
                className={cn(
                  "sr-only",
                  wide && "px-3 pt-1 pb-1 text-[10px] font-semibold tracking-[0.16em] text-violet-200/45 uppercase md:not-sr-only",
                )}
              >
                {section.label}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <NavLink key={item.id} item={item} wide={wide} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className={cn("flex items-center gap-1 p-2", wide && "md:p-3")}>
          <a
            href={signOutHref}
            title={signOutLabel}
            className={cn(
              "flex min-w-0 flex-1 items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm font-semibold text-violet-100/80 hover:bg-white/5 hover:text-white",
              wide && "md:justify-start md:px-3",
            )}
          >
            <LogOut size={18} />
            <span className={cn("sr-only truncate", wide && "md:not-sr-only")}>{signOutLabel}</span>
          </a>
          <button
            type="button"
            title={translations("settings.open")}
            aria-label={translations("settings.open")}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-violet-100/80 hover:bg-white/5 hover:text-white"
          >
            <Settings size={18} />
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <p aria-hidden="true" className={cn("shrink-0 px-4 pt-4 font-display text-lg font-semibold text-white", wide && "md:hidden")}>
          {title}
        </p>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
      {settingsOpen ? <SettingsDialog locale={locale} copy={settings} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}

function NavLink({ item, wide }: { item: NavItem; wide: boolean }) {
  const Icon = iconFor(item.id);
  return (
    <a
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm font-semibold",
        wide && "md:justify-start md:px-3",
        item.current && !item.dev && "bg-violet-600 text-white shadow-md shadow-violet-950/40",
        item.current && item.dev && "bg-rose-500/15 text-rose-200",
        !item.current && !item.dev && "text-violet-100/80 hover:bg-white/5 hover:text-white",
        !item.current && item.dev && "text-rose-400 hover:bg-rose-500/10 hover:text-rose-300",
      )}
    >
      <Icon size={18} />
      <span className={cn("sr-only", wide && "md:not-sr-only")}>{item.label}</span>
    </a>
  );
}

function iconFor(id: NavId): LucideIcon {
  const icons: Record<NavId, LucideIcon> = {
    overview: House,
    "open-close": Coins,
    "gaming-floor": LayoutGrid,
    "dealer-rotation": RefreshCcw,
    tournaments: Trophy,
    cashier: Wallet,
    "supervisor-logbook": BookOpen,
    incidents: AlertTriangle,
    employees: Users,
    me: CircleUser,
    schedule: CalendarDays,
    "time-attendance": Clock,
    requests: Inbox,
    training: GraduationCap,
    tasks: ListChecks,
    announcements: Megaphone,
    "knowledge-base": Library,
    inventory: Package,
    badbeat: Activity,
    statistics: BarChart3,
    reports: FileText,
    accounts: KeyRound,
    scopes: Shield,
    "audit-logs": ScrollText,
    "organization-settings": Settings,
  };
  return icons[id];
}
