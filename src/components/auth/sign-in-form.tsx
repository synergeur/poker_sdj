"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction, type SignInState } from "@/server/actions/auth";

const initialState: SignInState = { error: null };

const signInErrors = ["invalid", "account_invalid", "credentials", "unavailable"] as const;

type SignInError = (typeof signInErrors)[number];

export function SignInForm({
  copy,
}: {
  copy: {
    accountId: string;
    password: string;
    submit: string;
    submitting: string;
    errors: Record<SignInError, string>;
  };
}) {
  const [state, action, pending] = useActionState(signInAction, initialState);
  const errorKey = signInErrors.find((key) => key === state.error);
  const error = errorKey ? copy.errors[errorKey] : state.error ? copy.errors.invalid : null;

  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accountId">{copy.accountId}</Label>
        <Input
          id="accountId"
          name="accountId"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{copy.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="full" disabled={pending}>
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
