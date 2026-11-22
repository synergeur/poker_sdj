import { Spade } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", compact && "justify-center")}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-900/40">
        <Spade size={18} />
      </span>
      {compact ? (
        <span className="sr-only">{name}</span>
      ) : (
        <span className="font-display text-sm leading-tight font-semibold">{name}</span>
      )}
    </div>
  );
}
