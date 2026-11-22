"use client";

import { useEffect, useId, useRef } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/i18n/locale";

export function SettingsDialog({
  locale,
  copy,
  onClose,
}: {
  locale: Locale;
  copy: {
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
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/40 outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg font-semibold text-white">
            {copy.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-violet-50 hover:bg-white/10"
          >
            {copy.close}
          </button>
        </div>

        <section className="mt-5">
          <h3 className="text-[10px] tracking-[0.14em] text-violet-200/55 uppercase">
            {copy.language}
          </h3>
          <div className="mt-2 pt-8">
            <LanguageSwitcher
              locale={locale}
              label={copy.languageLabel}
              english={copy.english}
              french={copy.french}
            />
          </div>
        </section>

        <section className="mt-5">
          <h3 className="text-[10px] tracking-[0.14em] text-violet-200/55 uppercase">
            {copy.shortcuts}
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm">
              <span>{copy.sidebarShortcut}</span>
              <kbd className="rounded-lg border border-white/10 bg-[#141226] px-2 py-1 font-display text-xs font-semibold text-white">
                {copy.sidebarKeys}
              </kbd>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm">
              <span>{copy.languageShortcut}</span>
              <kbd className="rounded-lg border border-white/10 bg-[#141226] px-2 py-1 font-display text-xs font-semibold text-white">
                {copy.languageKeys}
              </kbd>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
