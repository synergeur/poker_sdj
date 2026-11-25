"use client";

import { Clock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, step) => String(step * 5).padStart(2, "0"));

export function TimeField({
  label,
  value,
  onChange,
  disabled,
  hourLabel,
  minuteLabel,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hourLabel: string;
  minuteLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ top: 0, left: 0, width: 280 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [hour, minute] = parts(value);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openPanel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 280);
    const panelHeight = 280;
    const below = window.innerHeight - rect.bottom;
    const top = below < panelHeight && rect.top > below ? rect.top - panelHeight - 8 : rect.bottom + 8;
    setPlace({ top, left: Math.min(rect.left, window.innerWidth - width - 8), width });
    setOpen(true);
  }

  function chooseHour(nextHour: string) {
    onChange(`${nextHour}:${minute || "00"}`);
  }

  function chooseMinute(nextMinute: string) {
    onChange(`${hour || "09"}:${nextMinute}`);
    setOpen(false);
  }

  const minutes = minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0c0a16] px-3 text-sm",
          disabled ? "cursor-not-allowed opacity-40" : "hover:border-violet-400/60",
          className,
        )}
      >
        <span className={value ? "text-white" : "text-violet-200/35"}>{value || "--:--"}</span>
        <Clock size={16} className="shrink-0 text-violet-200" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-labelledby={titleId}
              style={{ top: place.top, left: place.left, width: place.width }}
              className="fixed z-50 rounded-2xl border border-white/10 bg-[#141226] p-3 shadow-xl shadow-black/50"
            >
              <p id={titleId} className="sr-only">
                {label}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-2 text-xs tracking-wide text-violet-200/55 uppercase">{hourLabel}</p>
                  <div className="grid max-h-52 grid-cols-3 gap-1 overflow-y-auto overscroll-contain">
                    {HOURS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        data-selected={item === hour ? "hour" : undefined}
                        onClick={() => chooseHour(item)}
                        className={choiceClass(item === hour)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs tracking-wide text-violet-200/55 uppercase">{minuteLabel}</p>
                  <div className="grid max-h-52 grid-cols-3 gap-1 overflow-y-auto overscroll-contain">
                    {minutes.map((item) => (
                      <button key={item} type="button" onClick={() => chooseMinute(item)} className={choiceClass(item === minute)}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function choiceClass(selected: boolean) {
  return cn(
    "rounded-lg px-2 py-1.5 text-sm font-semibold",
    selected ? "bg-violet-600 text-white" : "bg-white/5 text-violet-100 hover:bg-white/10",
  );
}

function parts(value: string): [string, string] {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? [match[1], match[2]] : ["", ""];
}
