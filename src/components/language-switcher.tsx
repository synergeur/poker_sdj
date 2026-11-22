"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { setLocale } from "@/server/actions/locale";
import type { Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  locale,
  label,
  english,
  french,
  hotkey = false,
}: {
  locale: Locale;
  label: string;
  english: string;
  french: string;
  hotkey?: boolean;
}) {
  const router = useRouter();

  async function choose(next: Locale) {
    if (next === locale) return;
    await setLocale(next);
    router.refresh();
  }

  useEffect(() => {
    if (!hotkey) return;

    function onKey(event: KeyboardEvent) {
      if (!isLanguageShortcut(event) || isTypingTarget(event.target)) return;
      event.preventDefault();
      void setLocale(locale === "fr" ? "en" : "fr").then(() => router.refresh());
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, locale, router]);

  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <LanguageButton active={locale === "fr"} name={french} onClick={() => choose("fr")}>
        <FrenchFlag />
      </LanguageButton>
      <LanguageButton active={locale === "en"} name={english} onClick={() => choose("en")}>
        <EnglishFlag />
      </LanguageButton>
    </div>
  );
}

export function isLanguageShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === "l" && event.ctrlKey && !event.altKey && !event.metaKey;
}

export function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

function LanguageButton({
  active,
  name,
  children,
  onClick,
}: {
  active: boolean;
  name: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={name}
      onClick={onClick}
      className={cn(
        "group relative grid h-9 w-9 place-items-center rounded-xl border transition",
        active
          ? "border-violet-300/70 bg-violet-600/30"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
      )}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0c0a16] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 shadow-lg shadow-black/50 transition duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-white/10 bg-[#0c0a16]" />
        {name}
      </span>
    </button>
  );
}

function FrenchFlag() {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" className="h-4 w-6 overflow-hidden rounded-[3px] shadow-sm">
      <rect width="8" height="16" fill="#0055A4" />
      <rect x="8" width="8" height="16" fill="#FFFFFF" />
      <rect x="16" width="8" height="16" fill="#EF4135" />
    </svg>
  );
}

function EnglishFlag() {
  return (
    <svg viewBox="0 0 60 30" aria-hidden="true" className="h-4 w-6 overflow-hidden rounded-[3px] shadow-sm">
      <clipPath id="english-flag-clip">
        <rect width="60" height="30" />
      </clipPath>
      <g clipPath="url(#english-flag-clip)">
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#FFFFFF" strokeWidth="6" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0 V30 M0 15 H60" stroke="#FFFFFF" strokeWidth="10" />
        <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}
