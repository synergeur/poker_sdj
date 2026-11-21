import { useRoom } from '../../features/room/RoomContext.tsx'
import { formatShiftDate, formatTime } from '../../utils/time.ts'

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { snapshot } = useRoom()
  if (!snapshot) return null

  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display truncate text-lg font-semibold tracking-tight text-white">
          {title}
        </h1>
        {subtitle ? <p className="truncate text-xs text-violet-200/70">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-2xl border border-white/10 bg-[#141226] px-3 py-2">
          <p className="text-[10px] tracking-[0.14em] text-violet-200/55 uppercase">Date simulée</p>
          <p className="text-sm font-semibold text-white">{formatShiftDate(snapshot.clock)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#141226] px-3 py-2">
          <p className="text-[10px] tracking-[0.14em] text-violet-200/55 uppercase">
            Heure simulée
          </p>
          <p
            data-testid="clock-time"
            className="font-display text-lg leading-none font-semibold tabular-nums"
          >
            {formatTime(snapshot.clock)}
          </p>
        </div>
      </div>
    </header>
  )
}
