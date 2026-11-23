"use client";

import { LayoutGrid, Settings } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useRouter } from "next/navigation";

import { SettingsDialog } from "@/components/admin/settings-dialog";
import { BrandMark } from "@/components/brand-mark";
import { isLanguageShortcut, isTypingTarget } from "@/components/language-switcher";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/locale";

const SIDEBAR_KEY = "casino-room-sidebar-collapsed";

export function AdminShell({
  locale,
  name,
  nav,
  title,
  subtitle,
  signOut,
  settings,
  children,
}: {
  locale: Locale;
  name: string;
  nav: string;
  title: string;
  subtitle: string;
  signOut: string;
  settings: {
    open: string;
    title: string;
    close: string;
    language: string;
    languageLabel: string;
    english: string;
    french: string;
    shortcuts: string;
    sidebarShortcut: string;
    sidebarKeys: string;
    languageShortcut: string;
    languageKeys: string;
  };
  children: ReactNode;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-violet-50 lg:flex-row">
      <aside
        className={cn(
          "flex shrink-0 border-violet-200/10 bg-[#120a22] lg:h-full lg:border-r lg:border-b-0",
          collapsed
            ? "w-full flex-row items-center gap-2 border-b px-3 py-2 lg:w-[72px] lg:flex-col lg:gap-3 lg:px-0 lg:py-4"
            : "flex-col border-b lg:w-[108px]",
        )}
      >
        <div
          className={cn(
            collapsed ? "grid h-10 w-10 place-items-center" : "px-3 py-3 lg:px-2 lg:pt-4 lg:pb-3",
          )}
        >
          <BrandMark name={name} compact={collapsed} />
        </div>
        <nav
          className={cn(
            collapsed ? "grid h-10 w-10 place-items-center" : "px-2 pb-3 lg:flex-1",
          )}
        >
          <span
            title={nav}
            className={cn(
              "flex items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-950/40",
              collapsed
                ? "h-10 w-10"
                : "min-w-[88px] flex-col gap-1 px-2 py-2 text-center text-[11px] leading-tight",
            )}
          >
            <LayoutGrid size={18} />
            {collapsed ? <span className="sr-only">{nav}</span> : nav}
          </span>
        </nav>
        <div
          className={cn(
            collapsed
              ? "grid h-10 w-10 place-items-center lg:mt-auto"
              : "mt-auto px-2 pb-3",
          )}
        >
          <button
            type="button"
            title={settings.open}
            aria-label={settings.open}
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(true)}
            className={cn(
              "flex items-center justify-center rounded-2xl text-violet-100/75 hover:bg-white/5 hover:text-white",
              collapsed
                ? "h-10 w-10"
                : "min-w-[88px] flex-col gap-1 px-2 py-2 text-center text-[11px] leading-tight",
            )}
          >
            <Settings size={18} />
            {collapsed ? null : settings.open}
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-3 pt-4 lg:px-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold tracking-tight text-white md:text-[1.65rem]">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-violet-200/70">{subtitle}</p>
          </div>
          <a
            href="/auth/sign-out"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-violet-50 hover:bg-white/10"
          >
            {signOut}
          </a>
        </header>
        <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:p-4">{children}</main>
      </div>
      {settingsOpen ? (
        <SettingsDialog locale={locale} copy={settings} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </div>
  );
}
