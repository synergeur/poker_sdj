import { Suspense } from "react";

import { AdminScreen } from "@/components/admin/admin-screen";

export const instant = false;

export default function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; statusError?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-violet-200/70">
          Casino Room
        </div>
      }
    >
      <AdminScreen searchParams={searchParams} />
    </Suspense>
  );
}
