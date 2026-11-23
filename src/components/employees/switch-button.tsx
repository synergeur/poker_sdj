"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SwitchButton({
  pressed,
  onPressedChange,
  children,
  className,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "rounded-xl px-3 py-2 text-left text-sm font-semibold transition",
        pressed
          ? "bg-violet-600 text-white shadow-md shadow-violet-950/40"
          : "bg-[#0c0a16] text-violet-100/55 ring-1 ring-white/10 ring-inset hover:text-white",
        className,
      )}
    >
      {children}
    </button>
  );
}
