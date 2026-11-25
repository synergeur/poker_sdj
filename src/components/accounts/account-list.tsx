"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabel } from "@/lib/scopes/labels";
import type { ScopeFormError } from "@/lib/scopes/validation";
import { createEmployeeAction, type ScopeActionState } from "@/server/actions/scopes";
import type { ScopeManagerData } from "@/server/services/scopes";

const initialState: ScopeActionState = { error: null };

export function AccountList({
  data,
  copy,
  saved,
  bannerError,
  highlightUserId = null,
}: {
  data: ScopeManagerData;
  copy: {
    title: string;
    modalTitle: string;
    newAccount: string;
    close: string;
    saved: string;
    mainAccount: string;
    staff: string;
    ownerRole: string;
    statusActive: string;
    statusDisabled: string;
    create: string;
    creating: string;
    fields: {
      firstName: string;
      lastName: string;
      accountId: string;
      password: string;
      passwordConfirm: string;
    };
    errors: Record<ScopeFormError, string>;
  };
  saved: boolean;
  bannerError: string | null;
  highlightUserId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const staff = data.roles.find((role) => role.name === "staff");

  useEffect(() => {
    if (!highlightUserId) return;
    document.getElementById(`account-${highlightUserId}`)?.scrollIntoView({ block: "nearest" });
  }, [highlightUserId]);

  return (
    <div className="grid min-h-0 w-full flex-1 content-start gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-white">{copy.title}</h2>
        <Button type="button" className="shrink-0" onClick={() => setOpen(true)} disabled={!staff}>
          {copy.newAccount}
        </Button>
      </div>
      {saved ? (
        <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2 text-sm text-emerald-50">
          {copy.saved}
        </p>
      ) : null}
      {bannerError ? (
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {bannerError}
        </p>
      ) : null}
      <ul className="grid gap-2">
        {data.members.map((member) => {
          const role = data.roles.find((item) => item.id === member.roleId);
          const name = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.accountId;
          return (
            <li
              id={`account-${member.userId}`}
              key={member.userId}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                member.userId === highlightUserId ? "border-violet-400 bg-violet-600/20" : "border-white/10 bg-[#141226]"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{name}</p>
                <p className="truncate text-sm text-violet-100/70">
                  {member.accountId}
                  {" · "}
                  {roleLabel(role?.name, copy)}
                </p>
              </div>
              {member.isOwner ? (
                <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-950">
                  {copy.mainAccount}
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-violet-50">
                  {member.status === "active" ? copy.statusActive : copy.statusDisabled}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {open && staff ? (
        <NewAccountDialog
          roleId={staff.id}
          title={copy.modalTitle}
          copy={copy}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function NewAccountDialog({
  roleId,
  title,
  copy,
  onClose,
}: {
  roleId: string;
  title: string;
  copy: {
    close: string;
    create: string;
    creating: string;
    fields: {
      firstName: string;
      lastName: string;
      accountId: string;
      password: string;
      passwordConfirm: string;
    };
    errors: Record<ScopeFormError, string>;
  };
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [state, action, pending] = useActionState(createEmployeeAction, initialState);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose, pending]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={() => { if (!pending) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/40 outline-none"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-violet-50 hover:bg-white/10"
          >
            {copy.close}
          </button>
        </div>
        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="roleId" value={roleId} />
          <Field label={copy.fields.firstName}>
            <Input name="firstName" required autoComplete="off" />
          </Field>
          <Field label={copy.fields.lastName}>
            <Input name="lastName" required autoComplete="off" />
          </Field>
          <Field label={copy.fields.accountId} className="sm:col-span-2">
            <Input name="accountId" required autoCapitalize="none" spellCheck={false} autoComplete="off" />
          </Field>
          <Field label={copy.fields.password}>
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label={copy.fields.passwordConfirm}>
            <Input name="passwordConfirm" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          {state.error ? (
            <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50 sm:col-span-2">
              {copy.errors[state.error]}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? copy.creating : copy.create}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
