"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { employeeName, formatDay, formatWhen, hours, shown, fieldClass } from "@/components/employees/format";
import { Button } from "@/components/ui/button";
import type { EmployeeCopy, EmployeeNote, EmployeePerson } from "@/lib/employees/types";
import { roleLabel } from "@/lib/scopes/labels";
import {
  createEmployeeNoteAction,
  deleteEmployeeNoteStateAction,
  setEmployeeNoteVisibleStateAction,
} from "@/server/actions/employees";

export function EmployeeDirectory({
  people,
  selectedId,
  copy,
  canManageAccounts,
  saved,
  bannerError,
}: {
  people: EmployeePerson[];
  selectedId: string | null;
  copy: EmployeeCopy;
  canManageAccounts: boolean;
  saved: boolean;
  bannerError: string | null;
}) {
  const [records, setRecords] = useState(people);
  const [notice, setNotice] = useState<string | null>(bannerError);
  const [selectedUserId, setSelectedUserId] = useState(selectedId);
  const detailRef = useRef<HTMLDivElement>(null);
  const selected = records.find((person) => person.userId === selectedUserId) ?? records[0] ?? null;

  useEffect(() => {
    if (selectedId) setSelectedUserId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (detailRef.current) detailRef.current.scrollTop = 0;
  }, [selected?.userId]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {saved || notice ? (
        <div className="shrink-0 px-4 pt-4">
          <Banners saved={saved} savedLabel={copy.saved} error={notice} />
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,2fr)] gap-4 overflow-hidden p-4 lg:grid-cols-3 lg:grid-rows-1">
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden lg:col-span-1">
          <h2 className="shrink-0 font-display text-xl font-semibold text-white">{copy.title}</h2>
          <ul className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto overscroll-contain">
            {records.map((person) => {
              const active = person.userId === selected?.userId;
              return (
                <li key={person.userId}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(person.userId)}
                    aria-current={active ? "true" : undefined}
                    className={`block w-full rounded-2xl border px-4 py-3 text-left ${
                      active ? "border-violet-300 bg-violet-600 text-white" : "border-white/10 bg-[#141226] hover:border-violet-300/40"
                    }`}
                  >
                    <span className="block truncate font-semibold">{employeeName(person)}</span>
                    <span className={`mt-1 block truncate text-sm ${active ? "text-violet-100" : "text-violet-100/70"}`}>
                      {person.accountId}
                      {" · "}
                      {roleLabel(person.roleName, copy)}
                      {person.status === "disabled" ? ` · ${copy.statusDisabled}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        {selected ? (
          <div className="flex min-h-0 flex-col overflow-hidden lg:col-span-2">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 pb-4">
              <div className="min-w-0">
                <h2 className="truncate font-display text-2xl font-semibold text-white">{employeeName(selected)}</h2>
                <p className="mt-1 text-sm text-violet-100/70">
                  {selected.accountId}
                  {" · "}
                  {roleLabel(selected.roleName, copy)}
                  {" · "}
                  {selected.status === "disabled" ? copy.statusDisabled : copy.statusActive}
                </p>
              </div>
              {canManageAccounts ? (
                <Button asChild variant="ghost">
                  <a href={`/accounts?user=${selected.userId}`}>{copy.seeAccount}</a>
                </Button>
              ) : null}
            </div>
            <div ref={detailRef} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto overscroll-contain">
            <Panel title={copy.information}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Info label={copy.phone} value={shown(selected.phone, copy.notProvided)} />
                <Info label={copy.address} value={shown(selected.address, copy.notProvided)} />
                <Info
                  label={copy.emergency}
                  value={shown([selected.emergencyName, selected.emergencyPhone].filter(Boolean).join(" · "), copy.notProvided)}
                />
                <Info label={copy.other} value={shown(selected.other, copy.notProvided)} />
              </dl>
            </Panel>
            <Panel title={copy.availability} hint={copy.weekHint}>
              <h3 className="text-sm font-semibold text-violet-100">{copy.week}</h3>
              <WeekList person={selected} copy={copy} />
              <h3 className="mt-4 text-sm font-semibold text-violet-100">{copy.exceptions}</h3>
              <p className="mt-1 text-sm text-violet-100/65">{copy.exceptionHint}</p>
              {selected.exceptions.length === 0 ? (
                <p className="mt-3 text-sm text-violet-100/55">{copy.noExceptions}</p>
              ) : (
                <ul className="mt-3 grid gap-1">
                  {selected.exceptions.map((day) => (
                    <li key={day.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
                      <span>{formatDay(day.workDate, copy.locale)}</span>
                      <span className={day.available ? "font-semibold text-emerald-200" : "text-violet-100/55"}>
                        {hours(day, copy.unavailable)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <NotePanel
              person={selected}
              kind="evaluation"
              title={copy.evaluations}
              copy={copy}
              onError={setNotice}
              onNotes={(notes) => replaceNotes(setRecords, selected.userId, "evaluations", notes)}
            />
            <NotePanel
              person={selected}
              kind="comment"
              title={copy.comments}
              copy={copy}
              onError={setNotice}
              onNotes={(notes) => replaceNotes(setRecords, selected.userId, "comments", notes)}
            />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WeekList({ person, copy }: { person: EmployeePerson; copy: EmployeeCopy }) {
  return (
    <ul className="mt-3 grid gap-1">
      {person.weekdays.map((day) => (
        <li key={day.weekday} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
          <span>{copy.days[day.weekday - 1]}</span>
          <span className={day.available ? "font-semibold text-emerald-200" : "text-violet-100/55"}>
            {hours(day, copy.unavailable)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function replaceNotes(
  setRecords: Dispatch<SetStateAction<EmployeePerson[]>>,
  userId: string,
  key: "evaluations" | "comments",
  notes: EmployeeNote[],
) {
  setRecords((current) => current.map((person) => (person.userId === userId ? { ...person, [key]: notes } : person)));
}

function NotePanel({
  person,
  kind,
  title,
  copy,
  onError,
  onNotes,
}: {
  person: EmployeePerson;
  kind: "evaluation" | "comment";
  title: string;
  copy: EmployeeCopy;
  onError: (message: string | null) => void;
  onNotes: (notes: EmployeeNote[]) => void;
}) {
  const notes = kind === "evaluation" ? person.evaluations : person.comments;
  const [body, setBody] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  async function addNote() {
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    const result = await createEmployeeNoteAction({ userId: person.userId, kind, body: text, visible });
    setPending(false);
    if (!result.ok) {
      onError(copy.errors[result.error]);
      return;
    }
    onError(null);
    onNotes([result.note, ...notes]);
    setBody("");
    setVisible(false);
  }

  async function toggleNote(note: EmployeeNote) {
    const next = !note.visibleToEmployee;
    onNotes(notes.map((item) => (item.id === note.id ? { ...item, visibleToEmployee: next } : item)));
    const result = await setEmployeeNoteVisibleStateAction(note.id, next);
    if (!result.ok) {
      onNotes(notes);
      onError(copy.errors[result.error]);
    }
  }

  async function removeNote(note: EmployeeNote) {
    onNotes(notes.filter((item) => item.id !== note.id));
    const result = await deleteEmployeeNoteStateAction(note.id);
    if (!result.ok) {
      onNotes(notes);
      onError(copy.errors[result.error]);
    }
  }

  return (
    <Panel title={title}>
      {notes.length === 0 ? <p className="text-sm text-violet-100/55">{copy.emptyNotes}</p> : null}
      <ul className="grid gap-2">
        {notes.map((note) => (
          <li key={note.id}>
            <article className="rounded-xl border border-white/10 bg-[#0c0a16] p-3">
              <p className="text-sm whitespace-pre-wrap text-violet-50">{note.body}</p>
              <p className="mt-2 text-xs text-violet-100/55">
                {[note.authorName, formatWhen(note.createdAt, copy.locale)].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={note.visibleToEmployee}
                  onClick={() => void toggleNote(note)}
                  className={
                    note.visibleToEmployee
                      ? "rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950"
                      : "rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-violet-100"
                  }
                >
                  {note.visibleToEmployee ? copy.employeeCanSee : copy.hiddenFromEmployee}
                </button>
                <Button type="button" variant="ghost" onClick={() => void removeNote(note)}>
                  {copy.remove}
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void addNote();
        }}
      >
        <label className="grid gap-1.5 text-sm text-violet-100/80">
          {copy.noteBody}
          <textarea
            required
            maxLength={2000}
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={fieldClass}
          />
        </label>
        <button
          type="button"
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className={
            visible
              ? "w-fit rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950"
              : "w-fit rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-violet-100"
          }
        >
          {visible ? copy.employeeCanSee : copy.hiddenFromEmployee}
        </button>
        <div>
          <Button type="submit" disabled={pending}>
            {kind === "evaluation" ? copy.addEvaluation : copy.addComment}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs tracking-wide text-violet-200/55 uppercase">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-white">{value}</dd>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
      <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
      {hint ? <p className="mt-1 text-sm text-violet-100/65">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Banners({ saved, savedLabel, error }: { saved: boolean; savedLabel: string; error: string | null }) {
  return (
    <>
      {saved ? (
        <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-sm text-emerald-50">
          {savedLabel}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {error}
        </p>
      ) : null}
    </>
  );
}
