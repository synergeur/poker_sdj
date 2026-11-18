import { useState } from 'react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import type { ActivitySegment, TimelineView } from '../../types/room.ts'
import { cx } from '../../utils/cx.ts'
import { formatTime, shiftEnd, shiftStart } from '../../utils/time.ts'

const MARKS = Array.from({ length: 13 }, (_, index) => {
  const total = 17 * 60 + index * 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
})

function appearance(segment: ActivitySegment, color: string | undefined) {
  if (segment.kind === 'break') return { color: '#f5c542', label: 'Pause', text: '#1c1403' }
  if (segment.kind === 'table') {
    return { color: color ?? '#64748b', label: segment.tableId ?? 'Table', text: '#ffffff' }
  }
  if (segment.kind === 'off_shift')
    return { color: '#2c2940', label: 'Hors quart', text: '#c9c3dc' }
  return { color: '#45415c', label: 'Disponible', text: '#f3efff' }
}

export function RotationTimeline() {
  const { snapshot, select } = useRoom()
  const [view, setView] = useState<TimelineView>('rotation')
  if (!snapshot) return null

  const windowStart = shiftStart(snapshot.clock).getTime()
  const windowEnd = shiftEnd(snapshot.clock).getTime()
  const now = new Date(snapshot.clock).getTime()
  const span = windowEnd - windowStart
  const nowRatio = Math.min(1, Math.max(0, (now - windowStart) / span))

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141226] p-2">
      <header className="mb-1 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold">
            Pauses & rotations — vue chronologique
          </h2>
          <p className="truncate text-[11px] text-violet-100/55">
            Une ligne par croupier. Les hachures après {formatTime(snapshot.clock)} prolongent
            l'affectation actuelle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-violet-100/60">Plage : 17:00 – 23:00</span>
          <div className="flex rounded-full bg-black/30 p-1 text-xs">
            <button
              type="button"
              data-testid="view-rotation"
              className={cx(
                'rounded-full px-3 py-1',
                view === 'rotation' ? 'bg-violet-600 text-white' : 'text-violet-100/70',
              )}
              onClick={() => setView('rotation')}
            >
              Vue rotation
            </button>
            <button
              type="button"
              data-testid="view-breaks"
              className={cx(
                'rounded-full px-3 py-1',
                view === 'breaks' ? 'bg-amber-400 text-amber-950' : 'text-violet-100/70',
              )}
              onClick={() => setView('breaks')}
            >
              Vue pauses
            </button>
          </div>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-auto overscroll-contain"
        data-testid="dealer-scroll"
        aria-label="Liste des croupiers"
      >
        <div className="min-w-[760px]">
          <div className="sticky top-0 z-30 grid grid-cols-[88px_1fr] items-end bg-[#141226]">
            <span className="px-2 pb-1 text-[11px] tracking-wide text-violet-200/50 uppercase">
              Croupier
            </span>
            <div className="relative h-6">
              <span
                className="absolute top-0 z-10 -translate-x-1/2 rounded bg-white px-1 text-[10px] font-semibold text-slate-900"
                style={{ left: `${nowRatio * 100}%` }}
              >
                {formatTime(snapshot.clock)}
              </span>
              {MARKS.map((mark, index) => (
                <span
                  key={mark}
                  className="absolute top-0 -translate-x-1/2 text-[11px] text-violet-100/55 tabular-nums"
                  style={{ left: `${(index / (MARKS.length - 1)) * 100}%` }}
                >
                  {mark}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-1">
            {snapshot.dealers.map((dealer, index) => (
              <div
                key={dealer.id}
                className={cx(
                  'grid grid-cols-[88px_1fr] items-center',
                  index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent',
                )}
              >
                <button
                  type="button"
                  className="sticky left-0 z-20 flex h-9 items-center gap-2 bg-[#16132a] px-2 text-left text-sm font-semibold hover:text-white"
                  onClick={() => select({ type: 'dealer', id: dealer.id })}
                >
                  <span
                    className={cx(
                      'h-2 w-2 rounded-full',
                      dealer.status === 'assigned' && 'bg-violet-400',
                      dealer.status === 'on_break' && 'bg-amber-300',
                      dealer.status === 'available' && 'bg-emerald-400',
                      dealer.status === 'off_shift' && 'bg-slate-500',
                    )}
                  />
                  {dealer.displayName}
                </button>
                <div className="relative h-9 border-l border-white/5">
                  {MARKS.map((mark, markIndex) => (
                    <span
                      key={mark}
                      className="absolute inset-y-0 border-l border-white/5"
                      style={{ left: `${(markIndex / (MARKS.length - 1)) * 100}%` }}
                    />
                  ))}
                  {snapshot.segments
                    .filter((segment) => segment.dealerId === dealer.id)
                    .map((segment) => {
                      const start = Math.max(new Date(segment.start).getTime(), windowStart)
                      const rawEnd = segment.end ? new Date(segment.end).getTime() : windowEnd
                      const end = Math.min(rawEnd, windowEnd)
                      if (end <= start) return null
                      const table = snapshot.tables.find((item) => item.id === segment.tableId)
                      const look = appearance(segment, table?.timelineColor)
                      const dimmed = view === 'breaks' && segment.kind !== 'break'
                      const future =
                        segment.end === null && now > start && now < end
                          ? ((end - now) / (end - start)) * 100
                          : 0
                      return (
                        <button
                          key={segment.id}
                          type="button"
                          title={`${dealer.displayName} · ${look.label} · ${formatTime(new Date(start).toISOString())}`}
                          onClick={() =>
                            select(
                              segment.kind === 'table' && segment.tableId
                                ? { type: 'table', id: segment.tableId }
                                : { type: 'dealer', id: dealer.id },
                            )
                          }
                          className="absolute top-1.5 bottom-1.5 overflow-hidden rounded-md text-left"
                          style={{
                            left: `${((start - windowStart) / span) * 100}%`,
                            width: `${((end - start) / span) * 100}%`,
                            background: look.color,
                            color: look.text,
                            opacity: dimmed ? 0.28 : 1,
                          }}
                        >
                          {future > 0 ? (
                            <span
                              className="absolute inset-y-0 right-0"
                              style={{
                                width: `${future}%`,
                                backgroundImage:
                                  'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(0,0,0,0.22) 5px, rgba(0,0,0,0.22) 8px)',
                              }}
                            />
                          ) : null}
                          <span className="relative block truncate px-2 text-[11px] font-semibold">
                            {look.label}
                          </span>
                        </button>
                      )
                    })}
                  <span
                    data-testid={index === 0 ? 'now-line' : undefined}
                    className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-white"
                    style={{ left: `${nowRatio * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-1 flex shrink-0 gap-3 overflow-x-auto text-[11px] whitespace-nowrap text-violet-100/70">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded-sm bg-violet-500" /> Affectation, couleur propre à la
          table
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded-sm bg-amber-300" /> Pause
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded-sm bg-[#45415c]" /> Disponible
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-white" /> Heure actuelle
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="h-2.5 w-4 rounded-sm bg-violet-500"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.35) 3px, rgba(0,0,0,0.35) 4px)',
            }}
          />
          Prolongé, pas planifié
        </span>
      </footer>
    </section>
  )
}
