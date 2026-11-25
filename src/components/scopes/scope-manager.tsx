"use client";

import { Crown, Info, Lock, Plus, Shield, User, UsersRound, type LucideIcon } from "lucide-react";
import { useActionState, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabel } from "@/lib/scopes/labels";
import type { ScopeFormError } from "@/lib/scopes/validation";
import { cn } from "@/lib/utils";
import { deleteRoleAction, saveRoleAction, saveRoleScopesAction, updateMemberAction, type ScopeActionState } from "@/server/actions/scopes";
import type { ScopeManagerData, ScopeMember } from "@/server/services/scopes";

const initialState: ScopeActionState = { error: null };

export type ScopeCopy = {
  saved: string;
  manageScopes: string;
  manageRoles: string;
  employees: string;
  roles: string;
  rolesIntro: string;
  builtInBadge: string;
  scopes: string;
  newRole: string;
  mainAccount: string;
  locked: string;
  staff: string;
  ownerRole: string;
  builtIn: string;
  save: string;
  saving: string;
  create: string;
  creating: string;
  remove: string;
  fields: {
    role: string;
    description: string;
  };
  errors: Record<ScopeFormError, string>;
  scopeNames: Record<string, string>;
};

export function ScopeManager({
  data,
  copy,
  saved,
  bannerError,
  initialTab,
}: {
  data: ScopeManagerData;
  copy: ScopeCopy;
  saved: boolean;
  bannerError: string | null;
  initialTab: "scopes" | "roles";
}) {
  const [tab, setTab] = useState(initialTab);
  const [roleScopes, setRoleScopes] = useState<Record<string, string[]>>({});
  const roles = data.roles.map((role) => (roleScopes[role.id] ? { ...role, scopes: roleScopes[role.id] } : role));
  const live = { ...data, roles };

  return (
    <div className="grid min-h-0 w-full flex-1 content-start gap-4 overflow-y-auto p-4">
      <div
        role="tablist"
        aria-label={copy.manageScopes}
        className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-[#141226] p-1.5 shadow-lg shadow-black/20"
      >
        <TabButton icon={Shield} selected={tab === "scopes"} onClick={() => setTab("scopes")}>
          {copy.manageScopes}
        </TabButton>
        <TabButton icon={UsersRound} selected={tab === "roles"} onClick={() => setTab("roles")}>
          {copy.manageRoles}
        </TabButton>
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
      <div className={tab === "scopes" ? "contents" : "hidden"}>
        <AccessTab data={live} copy={copy} />
      </div>
      <div className={tab === "roles" ? "contents" : "hidden"}>
        <RolesTab
          data={data}
          copy={copy}
          onScopes={(roleId, scopes) => setRoleScopes((current) => ({ ...current, [roleId]: scopes }))}
        />
      </div>
    </div>
  );
}

function AccessTab({ data, copy }: { data: ScopeManagerData; copy: ScopeCopy }) {
  const [userId, setUserId] = useState(data.members[0]?.userId ?? "");
  const [drafts, setDrafts] = useState<Record<string, { roleId: string; extras: string[] }>>({});
  const [error, setError] = useState<ScopeFormError | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const queue = useRef(Promise.resolve());
  const draftsRef = useRef<Record<string, { roleId: string; extras: string[] }>>({});
  const confirmed = useRef<Record<string, { roleId: string; extras: string[] }>>({});
  const member = data.members.find((item) => item.userId === userId) ?? null;
  const view = member ? (drafts[member.userId] ?? { roleId: member.roleId, extras: member.extraScopes }) : null;
  const selectedRole = data.roles.find((role) => role.id === view?.roleId);

  function selectMember(next: ScopeMember) {
    setUserId(next.userId);
    setError(null);
    setStatus("idle");
  }

  function commit(person: ScopeMember, nextRoleId: string, nextExtras: string[]) {
    const next = { roleId: nextRoleId, extras: nextExtras };
    draftsRef.current = { ...draftsRef.current, [person.userId]: next };
    setDrafts(draftsRef.current);
    setStatus("saving");
    setError(null);
    queue.current = queue.current
      .then(async () => {
        const form = new FormData();
        form.set("userId", person.userId);
        form.set("roleId", nextRoleId);
        form.set("status", person.status);
        for (const scope of nextExtras) form.append("scopes", scope);
        const result = await updateMemberAction(initialState, form);
        const latest = draftsRef.current[person.userId];
        const current = latest?.roleId === next.roleId && sameList(latest.extras, next.extras);
        if (result.error) {
          if (!current) return;
          const fallback = confirmed.current[person.userId] ?? { roleId: person.roleId, extras: person.extraScopes };
          draftsRef.current = { ...draftsRef.current, [person.userId]: fallback };
          setDrafts(draftsRef.current);
          setError(result.error);
          setStatus("idle");
          return;
        }
        confirmed.current[person.userId] = next;
        if (current) setStatus("saved");
      })
      .catch(() => undefined);
  }

  function toggleScope(scope: string) {
    if (!member || !view || member.isOwner) return;
    if (selectedRole?.scopes.includes(scope)) return;
    const extras = view.extras.includes(scope) ? view.extras.filter((item) => item !== scope) : [...view.extras, scope];
    commit(member, view.roleId, extras);
  }

  function holdsScope(scope: string) {
    if (member?.isOwner) return true;
    if (view?.extras.includes(scope)) return true;
    return selectedRole?.scopes.includes(scope) ?? false;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={copy.employees}>
          <ul className="grid gap-1">
            {data.members.map((item) => {
              const active = item.userId === member?.userId;
              return (
                <li key={item.userId}>
                  <button
                    type="button"
                    onClick={() => selectMember(item)}
                    className={cn(
                      "w-full rounded-xl px-3 py-2 text-left",
                      active ? "bg-violet-600 text-white" : "text-violet-50 hover:bg-white/5",
                    )}
                  >
                    <span className="block font-semibold">{displayName(item)}</span>
                    <span className={cn("block text-xs", active ? "text-violet-100" : "text-violet-200/60")}>
                      {item.accountId}
                    </span>
                    {item.isOwner ? (
                      <span className="mt-1 inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-emerald-950">
                        {copy.mainAccount}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {member?.isOwner ? <p className="mt-3 text-xs text-violet-200/70">{copy.locked}</p> : null}
        </Panel>

        <Panel title={copy.scopes}>
          <ul className="grid gap-2">
            {data.scopes.map((scope) => {
              const on = holdsScope(scope);
              const fromRole = selectedRole?.scopes.includes(scope) ?? false;
              const locked = Boolean(member?.isOwner);
              return (
                <li key={scope}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!member || locked || fromRole}
                    onClick={() => toggleScope(scope)}
                    className={chipClass(on)}
                  >
                    {copy.scopeNames[scope] ?? scope}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title={copy.roles}>
          <ul className="grid gap-2">
            {data.roles.map((role) => {
              const on = role.id === view?.roleId;
              const assignable = role.name === "staff" || !role.system;
              const locked = Boolean(member?.isOwner) || (!assignable && !on);
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!member || locked}
                    onClick={() => {
                      if (!member || !view || role.id === view.roleId) return;
                      commit(member, role.id, view.extras);
                    }}
                    className={chipClass(on)}
                  >
                    {roleLabel(role.name, copy)}
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {member && !member.isOwner ? (
        <SaveStatus status={status} error={error} copy={copy} />
      ) : null}
    </div>
  );
}

function RolesTab({
  data,
  copy,
  onScopes,
}: {
  data: ScopeManagerData;
  copy: ScopeCopy;
  onScopes: (roleId: string, scopes: string[]) => void;
}) {
  const first = data.roles.find((role) => !role.system) ?? data.roles[0];
  const [selection, setSelection] = useState<string | "new">(first?.id ?? "new");
  const role = data.roles.find((item) => item.id === selection) ?? null;
  const [name, setName] = useState(role && !role.system ? role.name : "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [scopes, setScopes] = useState<string[]>(role?.scopes ?? []);
  const [state, action, pending] = useActionState(saveRoleAction, initialState);
  const [scopeError, setScopeError] = useState<ScopeFormError | null>(null);
  const [scopeStatus, setScopeStatus] = useState<"idle" | "saving" | "saved">("idle");
  const scopesRef = useRef<string[]>(role?.scopes ?? []);
  const scopeQueue = useRef(Promise.resolve());
  const drafted = useRef<Record<string, string[]>>({});
  const confirmed = useRef<Record<string, string[]>>(
    Object.fromEntries(data.roles.map((item) => [item.id, [...item.scopes]])),
  );
  const system = Boolean(role?.system);

  function choose(next: string | "new") {
    setSelection(next);
    setScopeError(null);
    setScopeStatus("idle");
    if (next === "new") {
      setName("");
      setDescription("");
      scopesRef.current = [];
      setScopes([]);
      return;
    }
    const picked = data.roles.find((item) => item.id === next);
    const nextScopes = picked ? [...(drafted.current[picked.id] ?? picked.scopes)] : [];
    setName(picked && !picked.system ? picked.name : "");
    setDescription(picked?.description ?? "");
    scopesRef.current = nextScopes;
    setScopes(nextScopes);
  }

  function toggle(scope: string) {
    if (!role || system) return;
    const current = scopesRef.current;
    const next = current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope];
    scopesRef.current = next;
    drafted.current[role.id] = next;
    onScopes(role.id, next);
    setScopes(next);
    setScopeStatus("saving");
    setScopeError(null);
    const roleId = role.id;
    const name = role.name;
    const description = role.description;
    scopeQueue.current = scopeQueue.current
      .then(async () => {
        const result = await saveRoleScopesAction({ roleId, name, description, scopes: next });
        const latest = scopesRef.current === next;
        if (result.error) {
          if (!latest) return;
          const fallback = confirmed.current[roleId] ?? current;
          scopesRef.current = fallback;
          drafted.current[roleId] = fallback;
          onScopes(roleId, fallback);
          setScopes(fallback);
          setScopeError(result.error);
          setScopeStatus("idle");
          return;
        }
        confirmed.current[roleId] = next;
        if (latest) setScopeStatus("saved");
      })
      .catch(() => undefined);
  }

  const heading = selection === "new" ? copy.newRole : roleLabel(role?.name, copy);
  const textDirty =
    selection === "new" ||
    name.trim() !== (role?.name ?? "").trim() ||
    description.trim() !== (role?.description ?? "").trim();
  const DetailIcon = roleIcon(selection === "new" ? undefined : role?.name);

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#141226] shadow-lg shadow-black/20">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <UsersRound size={28} className="shrink-0 text-violet-100" />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-white">{copy.roles}</h2>
            <p className="text-sm text-violet-200/60">{copy.rolesIntro}</p>
          </div>
        </div>
        <Button type="button" onClick={() => choose("new")}>
          <Plus size={16} />
          {copy.newRole}
        </Button>
      </header>
      <form action={action} className="grid min-h-[28rem] lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <div className="grid border-b border-white/10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:border-r lg:border-b-0">
          <div className="border-b border-white/10 p-3 lg:border-r lg:border-b-0">
            <p className="px-2 pb-2 text-xs font-semibold text-violet-200/55">
              {copy.roles} ({data.roles.length})
            </p>
            <ul className="grid gap-2">
              {data.roles.map((item) => {
                const selected = item.id === role?.id;
                const Icon = roleIcon(item.name);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => choose(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold",
                        selected ? "bg-violet-600 text-white" : "bg-[#1b1630] text-violet-50 hover:bg-white/5",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          selected ? "bg-white/15 text-white" : "bg-[#120a22] text-violet-100",
                        )}
                      >
                        <Icon size={16} />
                      </span>
                      {roleLabel(item.name, copy)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="p-4">
            {role?.id ? <input type="hidden" name="roleId" value={role.id} /> : null}
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-600/25 text-violet-100">
                <DetailIcon size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-semibold text-white">{heading}</h3>
                  {system ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-violet-100">
                      <Lock size={12} />
                      {copy.builtInBadge}
                    </span>
                  ) : null}
                </div>
                {system ? <p className="mt-1 text-sm text-violet-100/75">{description || "—"}</p> : null}
              </div>
            </div>
            {system ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2.5 text-sm text-violet-100/80">
                <Info size={16} className="shrink-0 text-violet-300" />
                {copy.builtIn}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                <Field label={copy.fields.role}>
                  <Input
                    name="name"
                    required
                    minLength={2}
                    maxLength={40}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Field>
                <Field label={copy.fields.description}>
                  <textarea
                    name="description"
                    maxLength={240}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-24 w-full rounded-xl border border-white/10 bg-[#0c0a16] px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
                  />
                </Field>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col p-4">
          <h3 className="font-display text-lg font-semibold text-white">{copy.scopes}</h3>
          <ul className="mt-3 grid gap-2">
            {data.scopes.map((scope) => {
              const on = scopes.includes(scope);
              return (
                <li key={scope}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={system}
                    onClick={() => toggle(scope)}
                    className={chipClass(on)}
                  >
                    {copy.scopeNames[scope] ?? scope}
                  </button>
                </li>
              );
            })}
          </ul>
          {scopes.map((scope) => (
            <input key={scope} type="hidden" name="scopes" value={scope} />
          ))}
          {!system ? (
            <div className="mt-4">
              <FormError error={state.error} errors={copy.errors} />
              {role ? <SaveStatus status={scopeStatus} error={scopeError} copy={copy} /> : null}
              <div className="flex flex-wrap items-center gap-2">
                {textDirty ? (
                  <Button type="submit" disabled={pending}>
                    {pending ? (role ? copy.saving : copy.creating) : role ? copy.save : copy.create}
                  </Button>
                ) : null}
                {role ? (
                  <button
                    type="submit"
                    form={`delete-role-${role.id}`}
                    className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                  >
                    {copy.remove}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </form>
      {role && !role.system ? (
        <form id={`delete-role-${role.id}`} action={deleteRoleAction} className="hidden">
          <input type="hidden" name="roleId" value={role.id} />
        </form>
      ) : null}
    </section>
  );
}

function roleIcon(name: string | undefined): LucideIcon {
  if (name === "organization_admin") return Crown;
  if (name === "staff") return User;
  return Shield;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
      <h2 className="font-display text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TabButton({
  icon: Icon,
  selected,
  onClick,
  children,
}: {
  icon: LucideIcon;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
        selected
          ? "bg-violet-600 text-white shadow-md shadow-violet-950/40"
          : "text-violet-100/75 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon size={18} />
      {children}
    </button>
  );
}

function sameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function SaveStatus({
  status,
  error,
  copy,
}: {
  status: "idle" | "saving" | "saved";
  error: ScopeFormError | null;
  copy: ScopeCopy;
}) {
  if (error) return <FormError error={error} errors={copy.errors} />;
  if (status === "idle") return null;
  return (
    <p role="status" className={cn("mb-3 text-sm", status === "saved" ? "text-emerald-200" : "text-violet-200/70")}>
      {status === "saving" ? copy.saving : copy.saved}
    </p>
  );
}

function chipClass(on: boolean) {
  return cn(
    "w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition disabled:cursor-default",
    on ? "bg-emerald-500 text-emerald-950" : "border border-white/10 bg-[#0c0a16] text-violet-100 hover:bg-white/5 disabled:hover:bg-[#0c0a16]",
  );
}

function displayName(member: ScopeMember) {
  return [member.firstName, member.lastName].filter(Boolean).join(" ") || member.accountId;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormError({
  error,
  errors,
}: {
  error: ScopeFormError | null;
  errors: Record<ScopeFormError, string>;
}) {
  if (!error) return null;
  return (
    <p role="alert" className="mb-3 rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50">
      {errors[error]}
    </p>
  );
}
