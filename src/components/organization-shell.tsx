"use client";

import { CalendarDays, CircleUser, House, IdCard, LogOut, Settings, Shield, Spade, Users, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { SettingsDialog } from "@/components/admin/settings-dialog";
import { BrandMark } from "@/components/brand-mark";
import { isLanguageShortcut, isTypingTarget } from "@/components/language-switcher";
import { isLocale, type Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/locale";

const SIDEBAR_KEY = "casino-room-sidebar-collapsed";

export function OrganizationShell({
  brand,
  eyebrow,
  title,
  signOutHref,
  signOutLabel,
  links,
  children,
}: {
  brand: string;
  eyebrow: string;
  title: string;
  signOutHref: string;
  signOutLabel: string;
  links: { href: string; label: string; current?: boolean }[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const translations = useTranslations();
  const localeValue = useLocale();
  const locale: Locale = isLocale(localeValue) ? localeValue : "fr";
  const [collapsed, setCollapsed] = useState(false);
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

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
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
        <nav className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2", wide && "md:px-3")}>
          {links.map((link) => {
            const Icon = iconFor(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.current ? "page" : undefined}
                title={link.label}
                className={cn(
                  "flex items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm font-semibold",
                  wide && "md:justify-start md:px-3",
                  link.current
                    ? "bg-violet-600 text-white shadow-md shadow-violet-950/40"
                    : "text-violet-100/80 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={18} />
                <span className={cn("sr-only", wide && "md:not-sr-only")}>{link.label}</span>
              </a>
            );
          })}
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

function iconFor(href: string): LucideIcon {
  if (href === "/scopes") return Shield;
  if (href === "/accounts") return Users;
  if (href === "/employees") return IdCard;
  if (href === "/badbeat") return Spade;
  if (href === "/schedule") return CalendarDays;
  if (href === "/me") return CircleUser;
  return House;
}
