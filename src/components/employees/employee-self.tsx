"use client";

import { CalendarDays, CircleUser, Clock, MapPin, MessageSquare, Phone, Plus, Trash2, UserRound, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { employeeName, fieldClass, formatDay, formatWhen, hours } from "@/components/employees/format";
import { TimeField } from "@/components/employees/time-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseEmployeeException, parseEmployeeProfile, parseEmployeeWeek } from "@/lib/employees/validation";
import type { EmployeeCopy, EmployeeNote, EmployeePerson } from "@/lib/employees/types";
import { cn } from "@/lib/utils";
import { saveMyInformationAction } from "@/server/actions/employees";

type DraftDay = {
  weekday: number;
  available: boolean;
  startsAt: string;
  endsAt: string;
};

type DraftException = {
  id: string;
  workDate: string;
  available: boolean;
  startsAt: string;
  endsAt: string;
};

type Draft = {
  phone: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  other: string;
  weekdays: DraftDay[];
  exceptions: DraftException[];
};

type ExceptionDraft = {
  workDate: string;
  available: boolean;
  startsAt: string;
  endsAt: string;
};

const emptyException: ExceptionDraft = { workDate: "", available: false, startsAt: "", endsAt: "" };

export function EmployeeSelf({
  person,
  copy,
  saved,
  bannerError,
}: {
  person: EmployeePerson;
  copy: EmployeeCopy;
  saved: boolean;
  bannerError: string | null;
}) {
  const [draft, setDraft] = useState(() => draftFrom(person));
  const [exceptionDraft, setExceptionDraft] = useState<ExceptionDraft>(emptyException);
  const [localError, setLocalError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved">("idle");
  const baseline = useRef(snapshot(draftFrom(person)));
  const baselineIds = useRef(person.exceptions.map((day) => day.id));
  const draftRef = useRef(draft);
  const saving = useRef(false);
  const queued = useRef(false);
  const incoming = snapshot(draftFrom(person));
  const seenIncoming = useRef(incoming);
  const alert = localError ?? bannerError;
  draftRef.current = draft;

  useEffect(() => {
    if (incoming === seenIncoming.current) return;
    seenIncoming.current = incoming;
    baseline.current = incoming;
    baselineIds.current = person.exceptions.map((day) => day.id);
    setDraft(draftFrom(person));
  }, [incoming, person]);

  useEffect(() => {
    if (snapshot(draft) === baseline.current) return;
    const timer = window.setTimeout(() => {
      void persist();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft]);

  async function persist() {
    queued.current = true;
    if (saving.current) return;
    saving.current = true;
    setPhase("saving");
    try {
      while (queued.current) {
        queued.current = false;
        const current = draftRef.current;
        const currentSnapshot = snapshot(current);
        if (currentSnapshot === baseline.current) continue;
        const profile = parseEmployeeProfile(current);
        const week = parseEmployeeWeek({ days: current.weekdays });
        if (!profile.ok || !week.ok) {
          setLocalError(copy.errors.invalid);
          setPhase("idle");
          continue;
        }
        const removedExceptionIds = baselineIds.current.filter((id) => !current.exceptions.some((day) => day.id === id));
        const result = await saveMyInformationAction({
          phone: current.phone,
          address: current.address,
          emergencyName: current.emergencyName,
          emergencyPhone: current.emergencyPhone,
          other: current.other,
          days: current.weekdays,
          exceptions: current.exceptions.map(({ workDate, available, startsAt, endsAt }) => ({
            workDate,
            available,
            startsAt,
            endsAt,
          })),
          removedExceptionIds,
        });
        if (snapshot(draftRef.current) !== currentSnapshot) queued.current = true;
        if (!result.ok) {
          setLocalError(copy.errors[result.error]);
          setPhase("idle");
          continue;
        }
        setLocalError(null);
        baseline.current = currentSnapshot;
        baselineIds.current = result.exceptions.map((day) => day.id);
        setDraft((existing) => ({
          ...existing,
          exceptions: existing.exceptions.map((day) => {
            const savedDay = result.exceptions.find((item) => item.workDate === day.workDate);
            return savedDay ? { ...day, id: savedDay.id } : day;
          }),
        }));
      }
      if (snapshot(draftRef.current) === baseline.current) setPhase("saved");
    } finally {
      saving.current = false;
      if (queued.current) void persist();
    }
  }

  function addException() {
    const parsed = parseEmployeeException(exceptionDraft);
    if (!parsed.ok) {
      setLocalError(copy.errors.invalid);
      return;
    }
    setLocalError(null);
    setDraft((current) => {
      const existing = current.exceptions.find((day) => day.workDate === parsed.data.workDate);
      const next: DraftException = {
        id: existing?.id ?? `draft-${parsed.data.workDate}`,
        workDate: parsed.data.workDate,
        available: parsed.data.available,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
      };
      const exceptions = existing
        ? current.exceptions.map((day) => (day.workDate === next.workDate ? next : day))
        : [...current.exceptions, next].sort((left, right) => left.workDate.localeCompare(right.workDate));
      return { ...current, exceptions };
    });
    setExceptionDraft(emptyException);
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {saved && !localError ? (
        <div className="shrink-0 px-4 pt-4">
          <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-sm text-emerald-50">
            {copy.saved}
          </p>
        </div>
      ) : null}
      {alert ? (
        <div className="shrink-0 px-4 pt-4">
          <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
            {alert}
          </p>
        </div>
      ) : null}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-950/40">
            <CircleUser size={24} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-semibold text-white">{copy.mine}</h2>
            <p className="truncate text-sm text-violet-100/70">{employeeName(person)}</p>
          </div>
        </div>
        <p role="status" className="shrink-0 text-sm text-violet-200/70">
          {phase === "saving" ? copy.saving : phase === "saved" ? copy.saved : ""}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <section className="grid gap-5 rounded-2xl border border-white/10 bg-[#141226] p-4">
            <CardTitle icon={UserRound} title={copy.informationTitle} hint={copy.informationHint} />
            <div className="grid gap-3 sm:grid-cols-2">
              <IconField icon={Phone} label={copy.phone} htmlFor="phone">
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  className="rounded-full"
                />
              </IconField>
              <IconField icon={MapPin} label={copy.address} htmlFor="address">
                <Input
                  id="address"
                  autoComplete="street-address"
                  maxLength={200}
                  value={draft.address}
                  onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                  className="rounded-full"
                />
              </IconField>
            </div>
            <div className="grid gap-3">
              <CardTitle icon={UserRound} title={copy.emergency} hint={copy.emergencyHint} />
              <div className="grid gap-3 sm:grid-cols-2">
                <IconField icon={UserRound} label={copy.emergencyName} htmlFor="emergencyName">
                  <Input
                    id="emergencyName"
                    autoComplete="name"
                    maxLength={80}
                    value={draft.emergencyName}
                    onChange={(event) => setDraft((current) => ({ ...current, emergencyName: event.target.value }))}
                    className="rounded-full"
                  />
                </IconField>
                <IconField icon={Phone} label={copy.emergencyPhone} htmlFor="emergencyPhone">
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={draft.emergencyPhone}
                    onChange={(event) => setDraft((current) => ({ ...current, emergencyPhone: event.target.value }))}
                    className="rounded-full"
                  />
                </IconField>
              </div>
            </div>
            <IconField icon={MessageSquare} label={copy.other} htmlFor="other">
              <textarea
                id="other"
                rows={4}
                maxLength={2000}
                value={draft.other}
                onChange={(event) => setDraft((current) => ({ ...current, other: event.target.value }))}
                className={cn(fieldClass, "min-h-28 rounded-2xl")}
              />
            </IconField>
          </section>
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#141226] p-4">
            <CardTitle icon={CalendarDays} title={copy.week} hint={copy.weekSubtitle} />
            <div className="hidden grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_3.25rem] gap-3 px-1 text-[11px] tracking-[0.14em] text-violet-200/45 uppercase sm:grid">
              <span>{copy.day}</span>
              <span>{copy.from}</span>
              <span>{copy.to}</span>
              <span className="sr-only">{copy.available}</span>
            </div>
            <ul className="grid gap-2">
              {draft.weekdays.map((day) => (
                <li key={day.weekday} className="grid items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_3.25rem] sm:gap-3">
                  <span
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-full px-3 text-sm font-semibold",
                      day.available ? "bg-violet-600 text-white" : "bg-white/10 text-violet-100/75",
                    )}
                  >
                    {copy.days[day.weekday - 1]}
                  </span>
                  <TimeField
                    label={`${copy.days[day.weekday - 1]} ${copy.from}`}
                    value={day.startsAt}
                    disabled={!day.available}
                    hourLabel={copy.hour}
                    minuteLabel={copy.minute}
                    onChange={(value) => setDayTime(setDraft, day.weekday, "startsAt", value)}
                    className="rounded-full"
                  />
                  <TimeField
                    label={`${copy.days[day.weekday - 1]} ${copy.to}`}
                    value={day.endsAt}
                    disabled={!day.available}
                    hourLabel={copy.hour}
                    minuteLabel={copy.minute}
                    onChange={(value) => setDayTime(setDraft, day.weekday, "endsAt", value)}
                    className="rounded-full"
                  />
                  <div className="flex justify-end">
                    <Toggle
                      pressed={day.available}
                      label={copy.days[day.weekday - 1]}
                      onPressedChange={(available) => setDayAvailable(setDraft, day.weekday, available)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#141226] p-4 xl:col-span-2">
            <CardTitle icon={CalendarDays} title={copy.exceptions} hint={copy.exceptionSubtitle} />
            {draft.exceptions.length === 0 ? (
              <p className="text-sm text-violet-100/55">{copy.noExceptions}</p>
            ) : (
              <ul className="grid gap-2">
                {draft.exceptions.map((day) => (
                  <li key={day.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0c0a16] px-3 py-3">
                    <span className="flex min-w-0 flex-wrap items-center gap-3 text-sm text-white">
                      <CalendarDays size={16} className="text-violet-200" aria-hidden="true" />
                      <span>{formatDay(day.workDate, copy.locale)}</span>
                      {day.available ? (
                        <span className="font-semibold text-violet-100">{hours(day, copy.unavailable)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-100">
                          <X size={12} aria-hidden="true" />
                          {copy.unavailable}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={copy.remove}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          exceptions: current.exceptions.filter((item) => item.id !== day.id),
                        }))
                      }
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-violet-100/70 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 rounded-2xl border border-white/10 bg-[#100e20] p-4">
              <h4 className="flex items-center gap-2 font-display text-base font-semibold text-white">
                <Plus size={16} className="text-violet-200" aria-hidden="true" />
                {copy.addException}
              </h4>
              <div className="flex flex-wrap items-end gap-3">
                <IconField icon={CalendarDays} label={copy.exceptionDate} htmlFor="exception-date" className="w-44">
                  <Input
                    id="exception-date"
                    type="date"
                    value={exceptionDraft.workDate}
                    onChange={(event) => setExceptionDraft((current) => ({ ...current, workDate: event.target.value }))}
                    className="rounded-full [color-scheme:dark]"
                  />
                </IconField>
                <div className="grid gap-1.5">
                  <span className="text-sm font-semibold text-violet-50">{copy.type}</span>
                  <div className="flex flex-wrap gap-2">
                    <TypeChoice
                      pressed={!exceptionDraft.available}
                      onClick={() =>
                        setExceptionDraft((current) => ({ ...current, available: false, startsAt: "", endsAt: "" }))
                      }
                    >
                      <X size={14} aria-hidden="true" />
                      {copy.unavailable}
                    </TypeChoice>
                    <TypeChoice
                      pressed={exceptionDraft.available}
                      onClick={() =>
                        setExceptionDraft((current) => ({
                          ...current,
                          available: true,
                          startsAt: current.startsAt || "09:00",
                          endsAt: current.endsAt || "17:00",
                        }))
                      }
                    >
                      <Clock size={14} aria-hidden="true" />
                      {copy.customHours}
                    </TypeChoice>
                  </div>
                </div>
                <div className="grid w-32 gap-1.5">
                  <span className="text-sm font-semibold text-violet-50">{copy.from}</span>
                  <TimeField
                    label={copy.from}
                    value={exceptionDraft.startsAt}
                    disabled={!exceptionDraft.available}
                    hourLabel={copy.hour}
                    minuteLabel={copy.minute}
                    onChange={(value) => setExceptionDraft((current) => ({ ...current, startsAt: value }))}
                    className="rounded-full"
                  />
                </div>
                <div className="grid w-32 gap-1.5">
                  <span className="text-sm font-semibold text-violet-50">{copy.to}</span>
                  <TimeField
                    label={copy.to}
                    value={exceptionDraft.endsAt}
                    disabled={!exceptionDraft.available}
                    hourLabel={copy.hour}
                    minuteLabel={copy.minute}
                    onChange={(value) => setExceptionDraft((current) => ({ ...current, endsAt: value }))}
                    className="rounded-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={addException}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500"
                >
                  <Plus size={15} aria-hidden="true" />
                  {copy.addShort}
                </button>
              </div>
            </div>
          </section>
          <SharedNotes title={copy.evaluations} notes={person.evaluations} copy={copy} />
          <SharedNotes title={copy.comments} notes={person.comments} copy={copy} />
        </div>
      </div>
    </div>
  );
}

function setDayAvailable(setDraft: Dispatch<SetStateAction<Draft>>, weekday: number, available: boolean) {
  setDraft((current) => ({
    ...current,
    weekdays: current.weekdays.map((day) => {
      if (day.weekday !== weekday) return day;
      if (!available) return { ...day, available: false, startsAt: "", endsAt: "" };
      return { ...day, available: true, startsAt: day.startsAt || "09:00", endsAt: day.endsAt || "17:00" };
    }),
  }));
}

function setDayTime(
  setDraft: Dispatch<SetStateAction<Draft>>,
  weekday: number,
  key: "startsAt" | "endsAt",
  value: string,
) {
  setDraft((current) => ({
    ...current,
    weekdays: current.weekdays.map((day) => (day.weekday === weekday ? { ...day, [key]: value } : day)),
  }));
}

function draftFrom(person: EmployeePerson): Draft {
  return {
    phone: person.phone,
    address: person.address,
    emergencyName: person.emergencyName,
    emergencyPhone: person.emergencyPhone,
    other: person.other,
    weekdays: person.weekdays.map((day) => ({
      weekday: day.weekday,
      available: day.available,
      startsAt: day.startsAt ?? "",
      endsAt: day.endsAt ?? "",
    })),
    exceptions: person.exceptions.map((day) => ({
      id: day.id,
      workDate: day.workDate,
      available: day.available,
      startsAt: day.startsAt ?? "",
      endsAt: day.endsAt ?? "",
    })),
  };
}

function snapshot(draft: Draft) {
  return JSON.stringify({
    phone: draft.phone,
    address: draft.address,
    emergencyName: draft.emergencyName,
    emergencyPhone: draft.emergencyPhone,
    other: draft.other,
    weekdays: draft.weekdays.map((day) => ({
      weekday: day.weekday,
      available: day.available,
      startsAt: day.available ? day.startsAt : "",
      endsAt: day.available ? day.endsAt : "",
    })),
    exceptions: [...draft.exceptions]
      .map((day) => ({
        workDate: day.workDate,
        available: day.available,
        startsAt: day.available ? day.startsAt : "",
        endsAt: day.available ? day.endsAt : "",
      }))
      .sort((left, right) => left.workDate.localeCompare(right.workDate)),
  });
}

function CardTitle({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={18} className="mt-1 shrink-0 text-violet-200" aria-hidden="true" />
      <div>
        <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
        {hint ? <p className="text-sm text-violet-100/60">{hint}</p> : null}
      </div>
    </div>
  );
}

function IconField({
  icon: Icon,
  label,
  htmlFor,
  className,
  children,
}: {
  icon: LucideIcon;
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-violet-100/75">
        <Icon size={14} aria-hidden="true" />
        {label}
      </Label>
      {children}
    </div>
  );
}

function Toggle({
  pressed,
  label,
  onPressedChange,
}: {
  pressed: boolean;
  label: string;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      onClick={() => onPressedChange(!pressed)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition", pressed ? "bg-violet-600" : "bg-white/15")}
    >
      <span
        aria-hidden="true"
        className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition", pressed ? "left-5" : "left-0.5")}
      />
    </button>
  );
}

function TypeChoice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold",
        pressed ? "bg-violet-600 text-white" : "bg-white/10 text-violet-100/75 hover:bg-white/15",
      )}
    >
      {children}
    </button>
  );
}

function SharedNotes({ title, notes, copy }: { title: string; notes: EmployeeNote[]; copy: EmployeeCopy }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      {notes.length === 0 ? <p className="mt-3 text-sm text-violet-100/55">{copy.sharedEmpty}</p> : null}
      <ul className="mt-3 grid gap-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded-xl border border-white/10 bg-[#0c0a16] p-3">
            <p className="text-sm whitespace-pre-wrap text-violet-50">{note.body}</p>
            <p className="mt-2 text-xs text-violet-100/55">
              {[note.authorName, formatWhen(note.createdAt, copy.locale)].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
