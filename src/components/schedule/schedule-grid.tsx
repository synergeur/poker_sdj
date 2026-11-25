"use client";

import { ArrowUpDown, Banknote, CalendarDays, ChevronLeft, ChevronRight, Clock, Layers, Maximize2, Trophy, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { useRef, useState, type PointerEvent } from "react";

import { cn } from "@/lib/utils";
import {
  availabilityBands,
  formatScheduleMinutes,
  SCHEDULE_SPAN_MINUTES,
  type AvailabilityTone,
  type ScheduleEmployee,
} from "@/lib/schedule/bands";
import {
  minutesFromRatio,
  orderedRange,
  pushedShifts,
  resizedEdge,
  shiftPlacementError,
  snapScheduleMinutes,
  type ScheduleShift,
  type ScheduleWriteError,
  type ShiftKind,
} from "@/lib/schedule/shifts";
import { shiftDate, weekDates } from "@/lib/schedule/week";
import { addScheduleShiftAction, deleteScheduleShiftAction, moveScheduleShiftAction } from "@/server/actions/schedule";

const DOT: Record<AvailabilityTone, string> = {
  available: "bg-emerald-400",
  off: "bg-white/30",
  exception: "bg-rose-400",
};

type CreateDrag = {
  mode: "create";
  userId: string;
  kind: ShiftKind;
  anchor: number;
  start: number;
  end: number;
};

type MoveDrag = {
  mode: "move";
  id: string;
  kind: ShiftKind;
  userId: string;
  duration: number;
  grab: number;
  start: number;
  end: number;
};

type ResizeDrag = {
  mode: "resize";
  edge: "start" | "end";
  id: string;
  kind: ShiftKind;
  userId: string;
  fixed: number;
  start: number;
  end: number;
};

type Drag = CreateDrag | MoveDrag | ResizeDrag;

type Notice = ScheduleWriteError;

export function ScheduleGrid({
  people,
  shifts,
  copy,
}: {
  people: ScheduleEmployee[];
  shifts: ScheduleShift[];
  copy: {
    title: string;
    subtitle: string;
    hint: string;
    employees: string;
    total: string;
    shiftCount: string;
    day: string;
    week: string;
    employee: string;
    unavailable: string;
    previous: string;
    next: string;
    expand: string;
    date: string;
    available: string;
    off: string;
    exception: string;
    cash: string;
    tournament: string;
    cashier: string;
    remove: string;
    resizeStart: string;
    resizeEnd: string;
    empty: string;
    errors: Record<ScheduleWriteError, string>;
  };
}) {
  const locale = useLocale();
  const [date, setDate] = useState(localDate);
  const [view, setView] = useState<"day" | "week">("day");
  const [nameOrder, setNameOrder] = useState<"asc" | "desc">("asc");
  const [tool, setTool] = useState<ShiftKind>("cash");
  const [drawn, setDrawn] = useState(shifts);
  const [draft, setDraft] = useState<Drag | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const drawnRef = useRef(shifts);
  const queue = useRef(Promise.resolve());
  const hours = Array.from({ length: 19 }, (_, hour) => hour);
  const cashiers = new Set(people.filter((person) => person.cashier).map((person) => person.userId));

  function remember(next: ScheduleShift[]) {
    drawnRef.current = next;
    setDrawn(next);
  }

  function enqueue(task: () => Promise<void>) {
    queue.current = queue.current.then(task).catch(() => undefined);
  }

  const minutesAt = (clientX: number) => {
    const track = gridRef.current?.querySelector("[data-track]");
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return minutesFromRatio((clientX - rect.left) / rect.width);
  };

  const employeeAt = (clientX: number, clientY: number) => {
    const hit = document.elementFromPoint(clientX, clientY);
    return hit?.closest("[data-track]")?.getAttribute("data-track");
  };

  const updateDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current;
    if (!current) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      if (event.clientX < rect.left + 48) scroller.scrollLeft -= 24;
      if (event.clientX > rect.right - 48) scroller.scrollLeft += 24;
      if (event.clientY < rect.top + 36) scroller.scrollTop -= 16;
      if (event.clientY > rect.bottom - 36) scroller.scrollTop += 16;
    }
    if (current.mode === "create") {
      const next = { ...current, ...orderedRange(current.anchor, minutesAt(event.clientX)) };
      dragRef.current = next;
      setDraft(next);
      return;
    }
    if (current.mode === "resize") {
      const next = { ...current, ...resizedEdge(current.edge, current.fixed, minutesAt(event.clientX)) };
      dragRef.current = next;
      setDraft(next);
      return;
    }
    let start = snapScheduleMinutes(minutesAt(event.clientX) - current.grab);
    start = Math.min(Math.max(0, start), SCHEDULE_SPAN_MINUTES - current.duration);
    const userId = employeeAt(event.clientX, event.clientY) ?? current.userId;
    const next = { ...current, userId, start, end: start + current.duration };
    dragRef.current = next;
    setDraft(next);
  };

  function layoutResize(drag: ResizeDrag, source: readonly ScheduleShift[]) {
    const shift: ScheduleShift = {
      id: drag.id,
      userId: drag.userId,
      workDate: date,
      kind: drag.kind,
      startMinutes: drag.start,
      endMinutes: drag.end,
    };
    const problem = shiftPlacementError([], shift, undefined, cashiers);
    if (problem) return problem === "kind" ? "range" : problem;
    const pushed = pushedShifts(source, shift, drag.edge);
    if (pushed === "range") return "range" as const;
    return { shift, pushed };
  }

  const finishDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraft(null);
    if (!drag) return;
    if (drag.mode === "resize") {
      const plan = layoutResize(drag, drawnRef.current);
      if (typeof plan === "string") {
        setNotice(plan);
        return;
      }
      const before = drawnRef.current.find((item) => item.id === plan.shift.id);
      if (
        plan.pushed.length === 0 &&
        before &&
        before.userId === plan.shift.userId &&
        before.startMinutes === plan.shift.startMinutes &&
        before.endMinutes === plan.shift.endMinutes
      ) {
        return;
      }
      const previous = drawnRef.current;
      const updates = new Map([plan.shift, ...plan.pushed].map((item) => [item.id, item]));
      remember(previous.map((item) => updates.get(item.id) ?? item));
      setNotice(null);
      enqueue(async () => {
        const saved: ScheduleShift[] = [];
        for (const item of [...plan.pushed, plan.shift]) {
          const result = await moveScheduleShiftAction(item);
          if (result.ok) {
            saved.push(item);
            continue;
          }
          for (const done of saved.reverse()) {
            const original = previous.find((current) => current.id === done.id);
            if (original) await moveScheduleShiftAction(original);
          }
          remember(previous);
          setNotice(result.error);
          return;
        }
      });
      return;
    }
    const existing = drag.mode === "create" ? undefined : drag.id;
    const shift: ScheduleShift = {
      id: existing ?? crypto.randomUUID(),
      userId: drag.userId,
      workDate: date,
      kind: drag.kind,
      startMinutes: drag.start,
      endMinutes: drag.end,
    };
    const problem = shiftPlacementError(drawnRef.current, shift, existing, cashiers);
    if (problem) {
      setNotice(problem === "kind" ? "range" : problem);
      return;
    }
    setNotice(null);
    if (drag.mode === "create") {
      remember([...drawnRef.current, shift]);
      enqueue(async () => {
        const result = await addScheduleShiftAction(shift);
        if (result.ok) return;
        remember(drawnRef.current.filter((item) => item.id !== shift.id));
        setNotice(result.error);
      });
      return;
    }
    const before = drawnRef.current.find((item) => item.id === shift.id);
    if (
      before &&
      before.userId === shift.userId &&
      before.startMinutes === shift.startMinutes &&
      before.endMinutes === shift.endMinutes
    ) {
      return;
    }
    const previous = drawnRef.current;
    remember(previous.map((item) => (item.id === shift.id ? shift : item)));
    enqueue(async () => {
      const result = await moveScheduleShiftAction(shift);
      if (result.ok) return;
      remember(previous);
      setNotice(result.error);
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 2) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-remove]")) return;
    const shiftEl = target.closest("[data-shift-id]");
    const handle = target.closest("[data-resize]");
    if (shiftEl && handle) {
      if (event.button !== 0) {
        event.preventDefault();
        return;
      }
      const id = shiftEl.getAttribute("data-shift-id");
      const shift = drawnRef.current.find((item) => item.id === id && item.workDate === date);
      const edge = handle.getAttribute("data-resize") === "end" ? "end" : "start";
      if (!shift) return;
      event.preventDefault();
      const next: ResizeDrag = {
        mode: "resize",
        edge,
        id: shift.id,
        kind: shift.kind,
        userId: shift.userId,
        fixed: edge === "start" ? shift.endMinutes : shift.startMinutes,
        start: shift.startMinutes,
        end: shift.endMinutes,
      };
      dragRef.current = next;
      setDraft(next);
      setNotice(null);
      capture(event);
      return;
    }
    if (shiftEl) {
      if (event.button !== 0) {
        event.preventDefault();
        return;
      }
      const id = shiftEl.getAttribute("data-shift-id");
      const shift = drawnRef.current.find((item) => item.id === id && item.workDate === date);
      if (!shift) return;
      event.preventDefault();
      const minutes = minutesAt(event.clientX);
      const next: MoveDrag = {
        mode: "move",
        id: shift.id,
        kind: shift.kind,
        userId: shift.userId,
        duration: shift.endMinutes - shift.startMinutes,
        grab: minutes - shift.startMinutes,
        start: shift.startMinutes,
        end: shift.endMinutes,
      };
      dragRef.current = next;
      setDraft(next);
      setNotice(null);
      capture(event);
      return;
    }
    const track = target.closest("[data-track]");
    if (!track) return;
    event.preventDefault();
    const userId = track.getAttribute("data-track");
    if (!userId) return;
    const anchor = minutesAt(event.clientX);
    const next: CreateDrag = {
      mode: "create",
      userId,
      kind: event.button === 2 ? "tournament" : tool,
      anchor,
      ...orderedRange(anchor, anchor),
    };
    dragRef.current = next;
    setDraft(next);
    setNotice(null);
    capture(event);
  };

  function removeShift(shift: ScheduleShift) {
    const previous = drawnRef.current;
    remember(previous.filter((item) => item.id !== shift.id));
    enqueue(async () => {
      const result = await deleteScheduleShiftAction(shift.id);
      if (result.ok) return;
      remember(previous);
      setNotice(result.error);
    });
  }

  const resizeResult = draft?.mode === "resize" ? layoutResize(draft, drawn) : null;
  const pushedById =
    resizeResult && typeof resizeResult !== "string" ? new Map(resizeResult.pushed.map((shift) => [shift.id, shift])) : null;
  const draftInvalid = !draft
    ? null
    : draft.mode === "resize"
      ? typeof resizeResult === "string"
        ? resizeResult
        : null
      : shiftPlacementError(
          drawnRef.current,
          {
            userId: draft.userId,
            workDate: date,
            kind: draft.kind,
            startMinutes: draft.start,
            endMinutes: draft.end,
          },
          draft.mode === "create" ? undefined : draft.id,
          cashiers,
        );

  function paint(userId: string): Array<ScheduleShift & { preview?: boolean }> {
    const saved = drawn
      .filter((shift) => shift.userId === userId && shift.workDate === date && !(draft && draft.mode !== "create" && draft.id === shift.id))
      .map((shift) => {
        const pushed = pushedById?.get(shift.id);
        return pushed ? { ...pushed, preview: true as const } : shift;
      });
    if (!draft || draft.userId !== userId) return saved;
    return [
      ...saved,
      {
        id: draft.mode === "create" ? "draft" : draft.id,
        userId,
        workDate: date,
        kind: draft.kind,
        startMinutes: draft.start,
        endMinutes: draft.end,
        preview: true,
      },
    ];
  }

  const listed = [...people].sort((left, right) => {
    const order = left.name.localeCompare(right.name);
    return nameOrder === "asc" ? order : -order;
  });
  const spanDates = view === "week" ? weekDates(date) : [date];
  const counted = drawn.filter((shift) => spanDates.includes(shift.workDate));
  const scheduledMinutes = counted.reduce((sum, shift) => sum + shift.endMinutes - shift.startMinutes, 0);
  const heading = formatDay(date, locale);
  const weekStart = formatDay(spanDates[0] ?? date, locale);
  const weekEnd = formatDay(spanDates[spanDates.length - 1] ?? date, locale);

  function changeDate(next: string) {
    dragRef.current = null;
    setDraft(null);
    setDate(next || localDate());
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <header className="flex shrink-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-950/40">
          <CalendarDays className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-white">{copy.title}</h1>
          <p className="truncate text-sm text-violet-100/60">{copy.subtitle}</p>
        </div>
      </header>

      <section className="grid shrink-0 grid-cols-4 gap-3">
        <StatCard icon={CalendarDays} value={view === "week" ? `${weekStart.date} – ${weekEnd.date}` : heading.date} label={view === "week" ? copy.week : heading.weekday} />
        <StatCard icon={Users} value={String(people.length)} label={copy.employees} />
        <StatCard icon={Clock} value={formatHours(scheduledMinutes)} label={copy.total} />
        <StatCard icon={Layers} value={String(counted.length)} label={copy.shiftCount} />
      </section>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center rounded-full border border-white/10 bg-[#141226] p-1">
            <button type="button" aria-label={copy.previous} onClick={() => changeDate(shiftDate(date, view === "week" ? -7 : -1))} className="grid size-8 place-items-center rounded-full text-violet-100 hover:bg-white/10">
              <ChevronLeft className="size-4" />
            </button>
            <label className="relative grid cursor-pointer place-items-center px-2 text-sm font-medium text-white">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-3.5 text-violet-200/70" aria-hidden />
                {heading.date}
              </span>
              <input
                aria-label={copy.date}
                type="date"
                value={date}
                onChange={(event) => changeDate(event.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0 [color-scheme:dark]"
              />
            </label>
            <button type="button" aria-label={copy.next} onClick={() => changeDate(shiftDate(date, view === "week" ? 7 : 1))} className="grid size-8 place-items-center rounded-full text-violet-100 hover:bg-white/10">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="flex h-10 items-center rounded-full border border-white/10 bg-[#141226] p-1">
            {(["cash", "tournament", "cashier"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={tool === kind}
                onClick={() => setTool(kind)}
                className={cn("h-8 rounded-full px-3 text-sm", tool === kind ? "bg-violet-600 text-white" : "text-violet-100/70")}
              >
                {shiftName(kind, copy)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 items-center rounded-full border border-white/10 bg-[#141226] p-1">
            {(["day", "week"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => {
                  dragRef.current = null;
                  setDraft(null);
                  setView(mode);
                }}
                className={cn("h-8 rounded-full px-3 text-sm", view === mode ? "bg-violet-600 text-white" : "text-violet-100/70")}
              >
                {mode === "day" ? copy.day : copy.week}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={copy.expand}
            onClick={() => {
              const board = boardRef.current;
              if (!board) return;
              if (document.fullscreenElement) void document.exitFullscreen();
              else void board.requestFullscreen();
            }}
            className="grid size-10 place-items-center rounded-full border border-white/10 bg-[#141226] text-violet-100 hover:bg-white/10"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
      </div>

      {notice ? (
        <p role="alert" className="shrink-0 rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {copy.errors[notice]}
        </p>
      ) : null}

      <section ref={boardRef} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141226]">
        <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2.5 text-xs text-violet-100/75">
          <Swatch className="size-2.5 rounded-full bg-emerald-400/70" label={copy.available} />
          <Swatch className="size-2.5 rounded-full bg-white/25" label={copy.off} />
          <Swatch className="size-2.5 rounded-full bg-rose-500" label={copy.exception} />
          <Swatch className="size-2.5 rounded-sm bg-emerald-800" label={copy.cash} />
          <Swatch className="size-2.5 rounded-sm bg-violet-700" label={copy.tournament} />
          <Swatch className="size-2.5 rounded-sm bg-amber-600" label={copy.cashier} />
        </div>
        {people.length === 0 ? (
          <p className="p-4 text-sm text-violet-100/70">{copy.empty}</p>
        ) : view === "week" ? (
          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto">
            <WeekBoard
              people={listed}
              shifts={drawn}
              days={spanDates}
              locale={locale}
              copy={copy}
              onPickDay={(next) => {
                changeDate(next);
                setView("day");
              }}
            />
          </div>
        ) : (
          <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto">
            <div
              ref={gridRef}
              className="min-w-[72rem] touch-none select-none"
              onPointerDown={onPointerDown}
              onPointerMove={updateDrag}
              onPointerUp={finishDrag}
              onPointerCancel={() => {
                dragRef.current = null;
                setDraft(null);
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className="sticky top-0 z-20 flex bg-[#141226]">
                <div className="sticky left-0 z-30 flex w-52 shrink-0 items-center border-b border-r border-white/10 bg-[#141226] px-3">
                  <button type="button" onClick={() => setNameOrder((order) => (order === "asc" ? "desc" : "asc"))} className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-violet-100/70">
                    {copy.employee}
                    <ArrowUpDown className="size-3.5" aria-hidden />
                  </button>
                </div>
                <div className="relative h-10 flex-1 border-b border-white/10">
                  {hours.map((hour) => (
                    <span
                      key={hour}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-violet-100/45",
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
              {listed.map((person) => (
                <div key={person.userId} className="flex">
                  <div className="sticky left-0 z-10 flex w-52 shrink-0 items-center gap-2 border-b border-r border-white/10 bg-[#141226] px-3">
                    <span className={cn("size-2 shrink-0 rounded-full", DOT[presence(person, date)])} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{person.name}</span>
                      {person.role ? <span className="block truncate text-[11px] text-amber-200/80">{person.role}</span> : null}
                    </span>
                  </div>
                  <div data-track={person.userId} role="group" aria-label={person.name} className="relative h-20 flex-1 border-b border-white/10">
                    {availabilityBands(person, date).map((band) => (
                      <div
                        key={`${band.start}-${band.tone}`}
                        className={cn(
                          "pointer-events-none absolute inset-y-2 overflow-hidden rounded-xl",
                          band.tone === "available" && "bg-emerald-400/35",
                          band.tone === "off" && "bg-white/[0.03]",
                          band.tone === "exception" && "flex items-center justify-center bg-rose-600/90 text-white",
                        )}
                        style={{
                          left: `${(band.start / SCHEDULE_SPAN_MINUTES) * 100}%`,
                          width: `${((band.end - band.start) / SCHEDULE_SPAN_MINUTES) * 100}%`,
                        }}
                      >
                        {band.tone === "exception" ? (
                          <span className="flex min-w-0 items-center gap-1.5 px-2 text-[11px] leading-tight font-semibold">
                            <X className="size-3.5 shrink-0" aria-hidden />
                            <span className="min-w-0">
                              <span className="block truncate">{copy.unavailable}</span>
                              <span className="block font-normal tabular-nums">
                                {formatScheduleMinutes(band.start)}–{formatScheduleMinutes(band.end)}
                              </span>
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ))}
                    {hours.slice(0, 18).map((hour) => (
                      <div key={hour} className="pointer-events-none absolute inset-y-0 border-l border-white/10" style={{ left: `${(hour / 18) * 100}%` }} />
                    ))}
                    {paint(person.userId).map((shift) => (
                      <div
                        key={shift.id}
                        data-shift-id={shift.preview ? undefined : shift.id}
                        role="group"
                        aria-label={`${shiftName(shift.kind, copy)} ${formatScheduleMinutes(shift.startMinutes)}–${formatScheduleMinutes(shift.endMinutes)}`}
                        className={cn(
                          "group absolute inset-y-2 z-10 flex items-center gap-1.5 overflow-hidden rounded-xl border px-2 text-white shadow-md shadow-black/25",
                          shift.kind === "cash" && "border-emerald-100/40 bg-emerald-800",
                          shift.kind === "tournament" && "border-violet-100/40 bg-violet-700",
                          shift.kind === "cashier" && "border-amber-100/50 bg-amber-600",
                          shift.preview && draft?.mode === "resize" && "cursor-ew-resize opacity-90",
                          shift.preview && draft?.mode !== "resize" && "cursor-grabbing opacity-90",
                          shift.preview ? null : "cursor-grab",
                          shift.preview && draftInvalid && "border-rose-100 bg-rose-600",
                        )}
                        style={{
                          left: `${(shift.startMinutes / SCHEDULE_SPAN_MINUTES) * 100}%`,
                          width: `${((shift.endMinutes - shift.startMinutes) / SCHEDULE_SPAN_MINUTES) * 100}%`,
                        }}
                      >
                        <ShiftGlyph kind={shift.kind} />
                        <span className="min-w-0 leading-tight">
                          <span className="block truncate text-[11px] font-semibold">{shiftName(shift.kind, copy)}</span>
                          <span className="block truncate text-[10px] tabular-nums text-white/85">
                            {formatScheduleMinutes(shift.startMinutes)}–{formatScheduleMinutes(shift.endMinutes)}
                          </span>
                        </span>
                        {shift.preview ? null : (
                          <>
                            <div data-resize="start" aria-label={copy.resizeStart} className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize" />
                            <div data-resize="end" aria-label={copy.resizeEnd} className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize" />
                            <button
                              type="button"
                              data-remove
                              aria-label={`${copy.remove} ${person.name}`}
                              className="absolute top-1 right-2 z-20 grid size-4 place-items-center rounded bg-black/25 text-[11px] leading-none opacity-0 group-hover:opacity-100 focus:opacity-100"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => removeShift(shift)}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function shiftName(kind: ShiftKind, copy: { cash: string; tournament: string; cashier: string }) {
  if (kind === "tournament") return copy.tournament;
  if (kind === "cashier") return copy.cashier;
  return copy.cash;
}

function capture(event: PointerEvent<HTMLDivElement>) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // A pointer that is already gone should not cancel the shift.
  }
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={className} />
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#141226] px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-200">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{value}</span>
        <span className="block truncate text-xs text-violet-100/55">{label}</span>
      </span>
    </div>
  );
}

function ShiftGlyph({ kind }: { kind: ShiftKind }) {
  const Icon = kind === "tournament" ? Trophy : kind === "cashier" ? Wallet : Banknote;
  return <Icon className="size-3.5 shrink-0" aria-hidden />;
}

function presence(person: ScheduleEmployee, date: string): AvailabilityTone {
  const bands = availabilityBands(person, date);
  if (bands.some((band) => band.tone === "available")) return "available";
  if (bands.some((band) => band.tone === "exception")) return "exception";
  return "off";
}

function WeekBoard({
  people,
  shifts,
  days,
  locale,
  copy,
  onPickDay,
}: {
  people: ScheduleEmployee[];
  shifts: ScheduleShift[];
  days: string[];
  locale: string;
  copy: { employee: string; cash: string; tournament: string; cashier: string };
  onPickDay: (date: string) => void;
}) {
  return (
    <div className="min-w-[72rem]">
      <div className="sticky top-0 z-20 flex bg-[#141226]">
        <div className="sticky left-0 z-30 flex w-52 shrink-0 items-center border-b border-r border-white/10 bg-[#141226] px-3 text-xs font-medium text-violet-100/70">
          {copy.employee}
        </div>
        {days.map((day) => {
          const label = formatDay(day, locale);
          return (
            <button key={day} type="button" onClick={() => onPickDay(day)} className="h-10 flex-1 border-b border-l border-white/10 text-xs text-violet-100/70 hover:bg-white/5">
              {label.weekday} {day.slice(8)}
            </button>
          );
        })}
      </div>
      {people.map((person) => (
        <div key={person.userId} className="flex">
          <div className="sticky left-0 z-10 flex w-52 shrink-0 items-center gap-2 border-b border-r border-white/10 bg-[#141226] px-3 py-2">
            <span className={cn("size-2 shrink-0 rounded-full", DOT[presence(person, days[0] ?? "")])} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{person.name}</span>
              {person.role ? <span className="block truncate text-[11px] text-amber-200/80">{person.role}</span> : null}
            </span>
          </div>
          {days.map((day) => (
            <div key={day} className="flex min-h-20 flex-1 flex-col gap-1 border-b border-l border-white/10 p-1">
              {shifts
                .filter((shift) => shift.userId === person.userId && shift.workDate === day)
                .map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => onPickDay(day)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-1.5 py-1 text-left text-[10px] leading-tight text-white",
                      shift.kind === "cash" && "bg-emerald-800",
                      shift.kind === "tournament" && "bg-violet-700",
                      shift.kind === "cashier" && "bg-amber-600",
                    )}
                  >
                    <ShiftGlyph kind={shift.kind} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{shiftName(shift.kind, copy)}</span>
                      <span className="block tabular-nums">
                        {formatScheduleMinutes(shift.startMinutes)}–{formatScheduleMinutes(shift.endMinutes)}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatDay(iso: string, locale: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const value = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return {
    date: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(value),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(value),
  };
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h ${rest} m`;
}

function localDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
