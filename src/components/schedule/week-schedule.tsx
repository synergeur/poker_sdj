"use client";

import { Banknote, Trophy, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatScheduleMinutes, SCHEDULE_SPAN_MINUTES } from "@/lib/schedule/bands";
import type { ScheduleShift, ShiftKind } from "@/lib/schedule/shifts";
import { shiftDate, weekDates } from "@/lib/schedule/week";

export function WeekSchedule({
  shifts,
  copy,
}: {
  shifts: ScheduleShift[];
  copy: {
    title: string;
    hint: string;
    empty: string;
    previous: string;
    next: string;
    today: string;
    days: string[];
    cash: string;
    tournament: string;
    cashier: string;
  };
}) {
  const [anchor, setAnchor] = useState(localDate);
  const today = localDate();
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const hours = Array.from({ length: 19 }, (_, hour) => hour);
  const visible = shifts.filter((shift) => days.includes(shift.workDate));

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">{copy.title}</h1>
          <p className="mt-1 max-w-xl text-sm text-violet-100/70">{copy.hint}</p>
          <p className="mt-1 text-sm text-violet-100/55">
            {dayLabel(days[0] ?? anchor, copy.days)} – {dayLabel(days[6] ?? anchor, copy.days)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setAnchor(shiftDate(days[0] ?? anchor, -7))}>
            {copy.previous}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAnchor(today)}>
            {copy.today}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAnchor(shiftDate(days[0] ?? anchor, 7))}>
            {copy.next}
          </Button>
        </div>
      </header>

      {visible.length === 0 ? <p className="mt-3 shrink-0 text-sm text-violet-100/70">{copy.empty}</p> : null}

      <section className="mt-4 min-h-0 flex-1 overflow-auto rounded-2xl border border-white/10 bg-[#141226]">
        <div className="min-w-[72rem]">
          <div className="sticky top-0 z-20 flex bg-[#141226]">
            <div className="sticky left-0 z-30 w-44 shrink-0 border-b border-r border-white/10 bg-[#141226]" />
            <div className="relative h-9 flex-1 border-b border-white/10">
              {hours.map((hour) => (
                <span
                  key={hour}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-violet-100/55",
                    hour === 0 && "left-2",
                    hour === 18 && "right-2",
                    hour !== 0 && hour !== 18 && "-translate-x-1/2",
                  )}
                  style={hour === 0 || hour === 18 ? undefined : { left: `${(hour / 18) * 100}%` }}
                >
                  {formatScheduleMinutes(hour * 60)}
                </span>
              ))}
            </div>
          </div>
          {days.map((date, index) => (
            <div key={date} className="flex">
              <div
                className={cn(
                  "sticky left-0 z-10 flex w-44 shrink-0 flex-col justify-center border-b border-r border-white/10 bg-[#141226] px-3",
                  date === today && "text-violet-100",
                )}
              >
                <span className="truncate text-sm font-medium text-white">{copy.days[index]}</span>
                <span className="text-[11px] text-violet-100/55">{date.slice(8)}</span>
              </div>
              <div className="relative h-16 flex-1 border-b border-white/10">
                {hours.slice(0, 18).map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-y-0 border-l border-white/10"
                    style={{ left: `${(hour / 18) * 100}%` }}
                  />
                ))}
                {visible
                  .filter((shift) => shift.workDate === date)
                  .map((shift) => (
                    <div
                      key={shift.id}
                      className={cn(
                        "absolute inset-y-2 z-10 flex items-center gap-1.5 overflow-hidden rounded-xl border px-2 text-white",
                        shiftTone(shift.kind),
                      )}
                      style={{
                        left: `${(shift.startMinutes / SCHEDULE_SPAN_MINUTES) * 100}%`,
                        width: `${((shift.endMinutes - shift.startMinutes) / SCHEDULE_SPAN_MINUTES) * 100}%`,
                      }}
                      aria-label={`${shiftName(shift.kind, copy)} ${formatScheduleMinutes(shift.startMinutes)}–${formatScheduleMinutes(shift.endMinutes)}`}
                    >
                      <ShiftGlyph kind={shift.kind} />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-[11px] font-semibold">{shiftName(shift.kind, copy)}</span>
                        <span className="block truncate text-[10px] tabular-nums text-white/85">
                          {formatScheduleMinutes(shift.startMinutes)}–{formatScheduleMinutes(shift.endMinutes)}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function shiftTone(kind: ShiftKind) {
  if (kind === "tournament") return "border-violet-100/40 bg-violet-700";
  if (kind === "cashier") return "border-amber-100/50 bg-amber-600";
  return "border-emerald-100/40 bg-emerald-800";
}

function ShiftGlyph({ kind }: { kind: ShiftKind }) {
  const Icon = kind === "tournament" ? Trophy : kind === "cashier" ? Wallet : Banknote;
  return <Icon className="size-3.5 shrink-0" aria-hidden />;
}

function shiftName(kind: ShiftKind, copy: { cash: string; tournament: string; cashier: string }) {
  if (kind === "tournament") return copy.tournament;
  if (kind === "cashier") return copy.cashier;
  return copy.cash;
}

function dayLabel(date: string, days: string[]) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  const index = weekday === 0 ? 6 : weekday - 1;
  return `${days[index] ?? date} ${date.slice(8)}`;
}

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
