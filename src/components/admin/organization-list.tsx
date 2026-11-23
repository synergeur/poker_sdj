import type { ComponentProps } from "react";

import { EditOrganizationButton } from "@/components/admin/edit-organization-dialog";
import { StatusButton } from "@/components/admin/status-button";
import { setOrganizationStatusAction } from "@/server/actions/organizations";
import type { OrganizationListItem } from "@/server/services/organizations";

export function OrganizationList({
  organizations,
  locale,
  copy,
}: {
  organizations: OrganizationListItem[];
  locale: string;
  copy: {
    columns: {
      name: string;
      slug: string;
      status: string;
      contact: string;
      admin: string;
      created: string;
    };
    status: { active: string; suspended: string };
    suspend: string;
    reactivate: string;
    working: string;
    empty: string;
    edit: string;
    editor: ComponentProps<typeof EditOrganizationButton>["copy"];
  };
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (organizations.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-[#141226] px-4 py-6 text-sm text-violet-100/70">
        {copy.empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#141226]">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="text-[10px] tracking-[0.14em] text-violet-200/55 uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">{copy.columns.name}</th>
            <th className="px-4 py-3 font-semibold">{copy.columns.slug}</th>
            <th className="px-4 py-3 font-semibold">{copy.columns.admin}</th>
            <th className="px-4 py-3 font-semibold">{copy.columns.contact}</th>
            <th className="px-4 py-3 font-semibold">{copy.columns.status}</th>
            <th className="px-4 py-3 font-semibold">{copy.columns.created}</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">{copy.columns.status}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((organization) => {
            const nextStatus = organization.status === "active" ? "suspended" : "active";
            return (
              <tr key={organization.id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{organization.name}</p>
                  {organization.address ? (
                    <p className="text-xs text-violet-200/60">{organization.address}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-violet-100/80">{organization.slug}</td>
                <td className="px-4 py-3 font-semibold text-white">
                  {organization.admins.length === 0
                    ? "—"
                    : organization.admins.map((admin) => (
                        <span key={admin.userId} className="block">
                          {admin.accountId}
                          {admin.firstName || admin.lastName ? (
                            <span className="mt-0.5 block text-xs font-normal text-violet-200/60">
                              {[admin.firstName, admin.lastName].filter(Boolean).join(" ")}
                            </span>
                          ) : null}
                        </span>
                      ))}
                </td>
                <td className="px-4 py-3 text-violet-100/80">{organization.contactEmail || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      organization.status === "active"
                        ? "rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-emerald-950"
                        : "rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white"
                    }
                  >
                    {copy.status[organization.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-violet-100/80">
                  {date.format(new Date(organization.createdAt))}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <EditOrganizationButton
                      organization={organization}
                      label={copy.edit}
                      copy={copy.editor}
                    />
                    <form action={setOrganizationStatusAction}>
                    <input type="hidden" name="organizationId" value={organization.id} />
                    <input type="hidden" name="status" value={nextStatus} />
                    <StatusButton
                      label={organization.status === "active" ? copy.suspend : copy.reactivate}
                      pendingLabel={copy.working}
                      variant={organization.status === "active" ? "danger" : "good"}
                    />
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
