"use server";

import { redirect } from "next/navigation";

import {
  isFormError,
  parseCreateOrganization,
  parseUpdateOrganization,
  type FormError,
} from "@/lib/validation/organization";
import {
  createOrganization,
  setOrganizationStatus,
  updateOrganizationAdmin,
} from "@/server/services/organizations";

export type CreateOrganizationState = { error: FormError | null };

export async function createOrganizationAction(
  _state: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const parsed = parseCreateOrganization({
    name: formData.get("name"),
    slug: formData.get("slug"),
    status: formData.get("status"),
    contactEmail: formData.get("contactEmail"),
    address: formData.get("address"),
    adminFirstName: formData.get("adminFirstName"),
    adminLastName: formData.get("adminLastName"),
    adminAccountId: formData.get("adminAccountId"),
    adminPassword: formData.get("adminPassword"),
    adminPasswordConfirm: formData.get("adminPasswordConfirm"),
  });

  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const result = await createOrganization(parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin?created=1");
}

export async function setOrganizationStatusAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const status = formData.get("status");
  if (!organizationId || (status !== "active" && status !== "suspended")) {
    redirect("/admin?statusError=invalid");
  }

  const result = await setOrganizationStatus(organizationId, status);
  if (!result.ok) {
    const error = isFormError(result.error) ? result.error : "failed";
    redirect(`/admin?statusError=${error}`);
  }

  redirect("/admin");
}

export type UpdateOrganizationState = { error: FormError | null };

export async function updateOrganizationAction(
  _state: UpdateOrganizationState,
  formData: FormData,
): Promise<UpdateOrganizationState> {
  const parsed = parseUpdateOrganization({
    organizationId: formData.get("organizationId"),
    adminUserId: formData.get("adminUserId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    contactEmail: formData.get("contactEmail"),
    address: formData.get("address"),
    adminFirstName: formData.get("adminFirstName"),
    adminLastName: formData.get("adminLastName"),
    adminAccountId: formData.get("adminAccountId"),
    adminPassword: formData.get("adminPassword"),
    adminPasswordConfirm: formData.get("adminPasswordConfirm"),
  });

  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const result = await updateOrganizationAdmin(parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect("/admin?updated=1");
}
