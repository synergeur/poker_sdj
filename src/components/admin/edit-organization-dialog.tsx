"use client";

import { useActionState, useEffect, useId, useState, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormError } from "@/lib/validation/organization";
import {
  updateOrganizationAction,
  type UpdateOrganizationState,
} from "@/server/actions/organizations";
import type { OrganizationListItem } from "@/server/services/organizations";

type EditError = Exclude<FormError, "credentials" | "account_cleanup_failed">;

const initialState: UpdateOrganizationState = { error: null };

export function EditOrganizationButton({
  organization,
  label,
  copy,
}: {
  organization: OrganizationListItem;
  label: string;
  copy: ComponentProps<typeof EditOrganizationDialog>["copy"];
}) {
  const [open, setOpen] = useState(false);
  if (organization.admins.length === 0) return null;

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <EditOrganizationDialog organization={organization} copy={copy} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

export function EditOrganizationDialog({
  organization,
  copy,
  onClose,
}: {
  organization: OrganizationListItem;
  copy: {
    title: string;
    close: string;
    establishment: string;
    administrator: string;
    fields: {
      name: string;
      slug: string;
      contactEmail: string;
      address: string;
      adminFirstName: string;
      adminLastName: string;
      adminAccountId: string;
      adminPassword: string;
      adminPasswordConfirm: string;
    };
    passwordHint: string;
    submit: string;
    submitting: string;
    errors: Record<EditError, string>;
  };
  onClose: () => void;
}) {
  const titleId = useId();
  const fieldId = useId();
  const [state, action, pending] = useActionState(updateOrganizationAction, initialState);
  const [adminUserId, setAdminUserId] = useState(organization.admins[0]?.userId ?? "");
  const selected = organization.admins.find((admin) => admin.userId === adminUserId) ?? organization.admins[0];
  const [firstName, setFirstName] = useState(selected?.firstName ?? "");
  const [lastName, setLastName] = useState(selected?.lastName ?? "");
  const [accountId, setAccountId] = useState(selected?.accountId ?? "");
  const error = state.error && state.error in copy.errors ? copy.errors[state.error as EditError] : null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function chooseAdmin(userId: string) {
    const next = organization.admins.find((admin) => admin.userId === userId);
    setAdminUserId(userId);
    setFirstName(next?.firstName ?? "");
    setLastName(next?.lastName ?? "");
    setAccountId(next?.accountId ?? "");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#141226] p-5 shadow-lg shadow-black/40"
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

        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="organizationId" value={organization.id} />
          <input type="hidden" name="adminUserId" value={adminUserId} />

          <p className="text-[10px] tracking-[0.14em] text-violet-200/55 uppercase sm:col-span-2">
            {copy.establishment}
          </p>
          <Field label={copy.fields.name} htmlFor={`${fieldId}-name`}>
            <Input id={`${fieldId}-name`} name="name" defaultValue={organization.name} required />
          </Field>
          <Field label={copy.fields.slug} htmlFor={`${fieldId}-slug`}>
            <Input
              id={`${fieldId}-slug`}
              name="slug"
              defaultValue={organization.slug}
              required
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <Field label={copy.fields.contactEmail} htmlFor={`${fieldId}-email`}>
            <Input
              id={`${fieldId}-email`}
              name="contactEmail"
              type="email"
              autoComplete="off"
              defaultValue={organization.contactEmail ?? ""}
            />
          </Field>
          <Field label={copy.fields.address} htmlFor={`${fieldId}-address`}>
            <Input
              id={`${fieldId}-address`}
              name="address"
              autoComplete="off"
              defaultValue={organization.address ?? ""}
            />
          </Field>

          <p className="mt-2 text-[10px] tracking-[0.14em] text-violet-200/55 uppercase sm:col-span-2">
            {copy.administrator}
          </p>
          {organization.admins.length > 1 ? (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor={`${fieldId}-admin`}>{copy.fields.adminAccountId}</Label>
              <select
                id={`${fieldId}-admin`}
                value={adminUserId}
                onChange={(event) => chooseAdmin(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
              >
                {organization.admins.map((admin) => (
                  <option key={admin.userId} value={admin.userId}>
                    {admin.accountId}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Field label={copy.fields.adminFirstName} htmlFor={`${fieldId}-first`}>
            <Input
              id={`${fieldId}-first`}
              name="adminFirstName"
              value={firstName}
              autoComplete="off"
              required
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>
          <Field label={copy.fields.adminLastName} htmlFor={`${fieldId}-last`}>
            <Input
              id={`${fieldId}-last`}
              name="adminLastName"
              value={lastName}
              autoComplete="off"
              required
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
          <Field label={copy.fields.adminAccountId} htmlFor={`${fieldId}-account`} className="sm:col-span-2">
            <Input
              id={`${fieldId}-account`}
              name="adminAccountId"
              value={accountId}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              onChange={(event) => setAccountId(event.target.value.toLowerCase())}
            />
          </Field>
          <Field label={copy.fields.adminPassword} htmlFor={`${fieldId}-password`}>
            <Input
              id={`${fieldId}-password`}
              name="adminPassword"
              type="password"
              autoComplete="new-password"
            />
          </Field>
          <Field label={copy.fields.adminPasswordConfirm} htmlFor={`${fieldId}-confirm`}>
            <Input
              id={`${fieldId}-confirm`}
              name="adminPasswordConfirm"
              type="password"
              autoComplete="new-password"
            />
          </Field>
          <p className="text-xs text-violet-200/60 sm:col-span-2">{copy.passwordHint}</p>
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50 sm:col-span-2"
            >
              {error}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || !adminUserId}>
              {pending ? copy.submitting : copy.submit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
