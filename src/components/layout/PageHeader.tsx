import { useRoom } from '../../features/room/RoomContext.tsx'
import { cx } from '../../utils/cx.ts'
import { formatShiftDate, formatTime } from '../../utils/time.ts'

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { snapshot, setRoomOpen } = useRoom()
  if (!snapshot) return null
  const roomOpen = snapshot.settings.roomOpen

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold tracking-tight text-white md:text-[1.65rem]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 max-w-3xl text-sm text-violet-200/70">{subtitle}</p> : null}
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
        <button
          type="button"
          data-testid="room-status"
          aria-pressed={roomOpen}
          onClick={() => setRoomOpen(!roomOpen)}
          className={cx(
            'rounded-full px-3 py-2 text-sm font-semibold',
            roomOpen ? 'bg-emerald-500 text-emerald-950' : 'bg-rose-500 text-white',
          )}
        >
          {roomOpen ? 'Salle ouverte' : 'Salle fermée'}
        </button>
      </div>
    </header>
  )
}
