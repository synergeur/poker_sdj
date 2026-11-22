"use client";

import { useActionState, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/validation/slug";
import type { FormError } from "@/lib/validation/organization";

type CreateError = Exclude<FormError, "credentials">;
import {
  createOrganizationAction,
  type CreateOrganizationState,
} from "@/server/actions/organizations";

const initialState: CreateOrganizationState = { error: null };

export function CreateOrganizationForm({
  copy,
}: {
  copy: {
    title: string;
    fields: {
      name: string;
      slug: string;
      status: string;
      contactEmail: string;
      address: string;
      adminFirstName: string;
      adminLastName: string;
      adminAccountId: string;
      adminPassword: string;
      adminPasswordConfirm: string;
    };
    statusActive: string;
    statusSuspended: string;
    hints: { slug: string; account: string };
    submit: string;
    submitting: string;
    errors: Record<CreateError, string>;
  };
}) {
  const [state, action, pending] = useActionState(createOrganizationAction, initialState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const error =
    state.error && state.error !== "credentials" ? copy.errors[state.error] : null;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
      <h2 className="font-display text-lg font-semibold">{copy.title}</h2>
      <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label={copy.fields.name} htmlFor="name">
          <Input
            id="name"
            name="name"
            value={name}
            required
            onChange={(event) => {
              const next = event.target.value;
              setName(next);
              if (!slugEdited) setSlug(slugify(next));
            }}
          />
        </Field>
        <Field label={copy.fields.slug} htmlFor="slug" hint={copy.hints.slug}>
          <Input
            id="slug"
            name="slug"
            value={slug}
            required
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
          />
        </Field>
        <Field label={copy.fields.status} htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue="active"
            className="w-full rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
          >
            <option value="active">{copy.statusActive}</option>
            <option value="suspended">{copy.statusSuspended}</option>
          </select>
        </Field>
        <Field label={copy.fields.contactEmail} htmlFor="contactEmail">
          <Input id="contactEmail" name="contactEmail" type="email" autoComplete="off" />
        </Field>
        <Field label={copy.fields.address} htmlFor="address" className="md:col-span-2">
          <Input id="address" name="address" autoComplete="street-address" />
        </Field>
        <Field label={copy.fields.adminFirstName} htmlFor="adminFirstName">
          <Input id="adminFirstName" name="adminFirstName" autoComplete="off" required />
        </Field>
        <Field label={copy.fields.adminLastName} htmlFor="adminLastName">
          <Input id="adminLastName" name="adminLastName" autoComplete="off" required />
        </Field>
        <Field
          label={copy.fields.adminAccountId}
          htmlFor="adminAccountId"
          hint={copy.hints.account}
          className="md:col-span-2"
        >
          <Input
            id="adminAccountId"
            name="adminAccountId"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </Field>
        <Field label={copy.fields.adminPassword} htmlFor="adminPassword">
          <Input
            id="adminPassword"
            name="adminPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field label={copy.fields.adminPasswordConfirm} htmlFor="adminPasswordConfirm">
          <Input
            id="adminPasswordConfirm"
            name="adminPasswordConfirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50 md:col-span-2"
          >
            {error}
          </p>
        ) : null}
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-violet-200/60">{hint}</p> : null}
    </div>
  );
}
