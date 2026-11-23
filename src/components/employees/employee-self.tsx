"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { employeeName, fieldClass, formatDay, formatWhen, hours } from "@/components/employees/format";
import { SwitchButton } from "@/components/employees/switch-button";
import { TimeField } from "@/components/employees/time-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseEmployeeException, parseEmployeeProfile, parseEmployeeWeek } from "@/lib/employees/validation";
import type { EmployeeCopy, EmployeeNote, EmployeePerson } from "@/lib/employees/types";
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
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-white">{copy.mine}</h2>
          <p className="mt-1 text-sm text-violet-100/70">{employeeName(person)}</p>
        </div>
        <p role="status" className="shrink-0 pt-1 text-sm text-violet-200/70">
          {phase === "saving" ? copy.saving : phase === "saved" ? copy.saved : ""}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#141226] p-4">
            <h3 className="font-display text-lg font-semibold text-white">{copy.information}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={copy.phone} htmlFor="phone">
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                />
              </Field>
              <Field label={copy.address} htmlFor="address">
                <Input
                  id="address"
                  autoComplete="street-address"
                  maxLength={200}
                  value={draft.address}
                  onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid gap-3">
              <p className="text-xs tracking-wide text-violet-200/55 uppercase">{copy.emergency}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={copy.emergencyName} htmlFor="emergencyName">
                  <Input
                    id="emergencyName"
                    autoComplete="name"
                    maxLength={80}
                    value={draft.emergencyName}
                    onChange={(event) => setDraft((current) => ({ ...current, emergencyName: event.target.value }))}
                  />
                </Field>
                <Field label={copy.emergencyPhone} htmlFor="emergencyPhone">
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    autoComplete="tel"
                    maxLength={40}
                    value={draft.emergencyPhone}
                    onChange={(event) => setDraft((current) => ({ ...current, emergencyPhone: event.target.value }))}
                  />
                </Field>
              </div>
            </div>
            <Field label={copy.other} htmlFor="other">
              <textarea
                id="other"
                rows={4}
                maxLength={2000}
                value={draft.other}
                onChange={(event) => setDraft((current) => ({ ...current, other: event.target.value }))}
                className={fieldClass}
              />
            </Field>
          </section>
          <section className="grid gap-3 rounded-2xl border border-white/10 bg-[#141226] p-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">{copy.week}</h3>
              <p className="mt-1 text-sm text-violet-100/65">{copy.weekHint}</p>
            </div>
            {draft.weekdays.map((day) => (
              <div key={day.weekday} className="grid items-end gap-2 sm:grid-cols-[9rem_1fr_1fr]">
                <SwitchButton
                  pressed={day.available}
                  onPressedChange={(available) => setDayAvailable(setDraft, day.weekday, available)}
                  className="h-10"
                >
                  {copy.days[day.weekday - 1]}
                </SwitchButton>
                <LabeledTime
                  caption={copy.from}
                  label={`${copy.days[day.weekday - 1]} ${copy.from}`}
                  value={day.startsAt}
                  disabled={!day.available}
                  hourLabel={copy.hour}
                  minuteLabel={copy.minute}
                  onChange={(value) => setDayTime(setDraft, day.weekday, "startsAt", value)}
                />
                <LabeledTime
                  caption={copy.to}
                  label={`${copy.days[day.weekday - 1]} ${copy.to}`}
                  value={day.endsAt}
                  disabled={!day.available}
                  hourLabel={copy.hour}
                  minuteLabel={copy.minute}
                  onChange={(value) => setDayTime(setDraft, day.weekday, "endsAt", value)}
                />
              </div>
            ))}
          </section>
          <section className="grid gap-4 rounded-2xl border border-white/10 bg-[#141226] p-4 xl:col-span-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">{copy.exceptions}</h3>
              <p className="mt-1 text-sm text-violet-100/65">{copy.exceptionHint}</p>
            </div>
            {draft.exceptions.length === 0 ? (
              <p className="text-sm text-violet-100/55">{copy.noExceptions}</p>
            ) : (
              <ul className="grid gap-2">
                {draft.exceptions.map((day) => (
                  <li key={day.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2">
                    <span className="text-sm text-white">
                      {formatDay(day.workDate, copy.locale)}
                      {" · "}
                      <span className={day.available ? "font-semibold text-emerald-200" : "text-violet-100/70"}>
                        {hours(day, copy.unavailable)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          exceptions: current.exceptions.filter((item) => item.id !== day.id),
                        }))
                      }
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-violet-100/80 hover:bg-white/10 hover:text-white"
                    >
                      {copy.remove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
              <Field label={copy.exceptionDate} htmlFor="exception-date">
                <Input
                  id="exception-date"
                  type="date"
                  value={exceptionDraft.workDate}
                  onChange={(event) => setExceptionDraft((current) => ({ ...current, workDate: event.target.value }))}
                  className="[color-scheme:dark]"
                />
              </Field>
              <LabeledTime
                caption={copy.from}
                label={copy.from}
                value={exceptionDraft.startsAt}
                disabled={!exceptionDraft.available}
                hourLabel={copy.hour}
                minuteLabel={copy.minute}
                onChange={(value) => setExceptionDraft((current) => ({ ...current, startsAt: value }))}
              />
              <LabeledTime
                caption={copy.to}
                label={copy.to}
                value={exceptionDraft.endsAt}
                disabled={!exceptionDraft.available}
                hourLabel={copy.hour}
                minuteLabel={copy.minute}
                onChange={(value) => setExceptionDraft((current) => ({ ...current, endsAt: value }))}
              />
              <SwitchButton
                pressed={exceptionDraft.available}
                onPressedChange={(available) =>
                  setExceptionDraft((current) => ({
                    ...current,
                    available,
                    startsAt: available ? current.startsAt || "09:00" : "",
                    endsAt: available ? current.endsAt || "17:00" : "",
                  }))
                }
                className="h-10"
              >
                {exceptionDraft.available ? copy.available : copy.unavailable}
              </SwitchButton>
            </div>
            <div>
              <button
                type="button"
                onClick={addException}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-violet-100 ring-1 ring-violet-400/40 ring-inset hover:bg-violet-600/20"
              >
                {copy.addException}
              </button>
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

function LabeledTime({
  caption,
  label,
  value,
  disabled,
  hourLabel,
  minuteLabel,
  onChange,
}: {
  caption: string;
  label: string;
  value: string;
  disabled: boolean;
  hourLabel: string;
  minuteLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-violet-200/55 uppercase">{caption}</span>
      <TimeField
        label={label}
        value={value}
        disabled={disabled}
        hourLabel={hourLabel}
        minuteLabel={minuteLabel}
        onChange={onChange}
      />
    </div>
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

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
