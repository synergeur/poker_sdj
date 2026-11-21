import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import {
  SCHEDULE_SPAN_MINUTES,
  formatScheduleMinutes,
  minutesFromRatio,
  orderedRange,
  snapScheduleMinutes,
} from '../../features/schedule/grid.ts'
import { shiftPlacementError } from '../../features/schedule/shifts.ts'
import type { ScheduleKind, ScheduleShift } from '../../types/room.ts'
import { cx } from '../../utils/cx.ts'

type CreateDrag = {
  mode: 'create'
  dealerId: string
  kind: ScheduleKind
  anchor: number
  start: number
  end: number
}

type MoveDrag = {
  mode: 'move'
  id: string
  kind: ScheduleKind
  dealerId: string
  duration: number
  grab: number
  start: number
  end: number
}

type Drag = CreateDrag | MoveDrag

const HOURS = Array.from({ length: 19 }, (_, index) => index)

function blockStyle(start: number, end: number): { top: string; height: string } {
  return {
    top: `${(start / SCHEDULE_SPAN_MINUTES) * 100}%`,
    height: `${((end - start) / SCHEDULE_SPAN_MINUTES) * 100}%`,
  }
}

export function ScheduleGrid() {
  const room = useRoom()
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [draft, setDraft] = useState<Drag | null>(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const onWheel = (event: WheelEvent) => {
      if (scroller.scrollWidth <= scroller.clientWidth) return
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      scroller.scrollLeft += event.deltaY
      event.preventDefault()
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [])

  if (!room.snapshot) return null
  const snapshot = room.snapshot

  const minutesAt = (clientY: number) => {
    const track = gridRef.current?.querySelector('[data-track]')
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    if (rect.height <= 0) return 0
    return minutesFromRatio((clientY - rect.top) / rect.height)
  }

  const dealerAt = (clientX: number, clientY: number) => {
    const hit = document.elementFromPoint(clientX, clientY)
    return hit?.closest('[data-track]')?.getAttribute('data-track')
  }

  const updateDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    if (!current) return
    const scroller = scrollerRef.current
    if (scroller) {
      const rect = scroller.getBoundingClientRect()
      if (event.clientX < rect.left + 36) scroller.scrollLeft -= 18
      if (event.clientX > rect.right - 36) scroller.scrollLeft += 18
    }
    if (current.mode === 'create') {
      const next = { ...current, ...orderedRange(current.anchor, minutesAt(event.clientY)) }
      dragRef.current = next
      setDraft(next)
      return
    }
    const duration = current.duration
    let start = snapScheduleMinutes(minutesAt(event.clientY) - current.grab)
    start = Math.min(Math.max(0, start), SCHEDULE_SPAN_MINUTES - duration)
    const dealerId = dealerAt(event.clientX, event.clientY) ?? current.dealerId
    const next = { ...current, dealerId, start, end: start + duration }
    dragRef.current = next
    setDraft(next)
  }

  const finishDrag = () => {
    const drag = dragRef.current
    dragRef.current = null
    setDraft(null)
    if (!drag) return
    const draftShift = {
      dealerId: drag.dealerId,
      kind: drag.kind,
      startMinutes: drag.start,
      endMinutes: drag.end,
    }
    if (drag.mode === 'create') room.addScheduleShift(draftShift)
    else room.moveScheduleShift(drag.id, draftShift)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 2) return
    const target = event.target as HTMLElement
    if (target.closest('[data-remove]')) return
    const shiftEl = target.closest('[data-shift-id]')
    if (shiftEl) {
      if (event.button !== 0) {
        event.preventDefault()
        return
      }
      const id = shiftEl.getAttribute('data-shift-id')
      const shift = snapshot.shifts.find((item) => item.id === id)
      if (!shift) return
      event.preventDefault()
      const minutes = minutesAt(event.clientY)
      const drag: MoveDrag = {
        mode: 'move',
        id: shift.id,
        kind: shift.kind,
        dealerId: shift.dealerId,
        duration: shift.endMinutes - shift.startMinutes,
        grab: minutes - shift.startMinutes,
        start: shift.startMinutes,
        end: shift.endMinutes,
      }
      dragRef.current = drag
      setDraft(drag)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    const track = target.closest('[data-track]')
    if (!track) return
    event.preventDefault()
    const dealerId = track.getAttribute('data-track')
    if (!dealerId) return
    const anchor = minutesAt(event.clientY)
    const drag: CreateDrag = {
      mode: 'create',
      dealerId,
      kind: event.button === 2 ? 'tournament' : 'cash',
      anchor,
      ...orderedRange(anchor, anchor),
    }
    dragRef.current = drag
    setDraft(drag)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const draftInvalid = draft
    ? shiftPlacementError(
        snapshot,
        {
          dealerId: draft.dealerId,
          kind: draft.kind,
          startMinutes: draft.start,
          endMinutes: draft.end,
        },
        draft.mode === 'move' ? draft.id : undefined,
      )
    : null

  const paint = (dealerId: string): Array<ScheduleShift & { preview?: boolean }> => {
    const saved = snapshot.shifts.filter(
      (shift) => shift.dealerId === dealerId && !(draft?.mode === 'move' && draft.id === shift.id),
    )
    if (!draft || draft.dealerId !== dealerId) return saved
    return [
      ...saved,
      {
        id: draft.mode === 'move' ? draft.id : 'draft',
        dealerId,
        kind: draft.kind,
        startMinutes: draft.start,
        endMinutes: draft.end,
        preview: true,
      },
    ]
  }

  return (
    <div
      ref={gridRef}
      className="flex h-full min-h-0 select-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={updateDrag}
      onPointerUp={finishDrag}
      onPointerCancel={() => {
        dragRef.current = null
        setDraft(null)
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex w-14 shrink-0 flex-col">
        <div className="h-9 shrink-0" />
        <div className="relative min-h-0 flex-1">
          {HOURS.map((hour) => (
            <span
              key={hour}
              className={cx(
                'absolute right-1 text-[10px] leading-none text-violet-100/55 tabular-nums',
                hour === 0 && 'top-0',
                hour === 18 && 'bottom-0',
                hour > 0 && hour < 18 && '-translate-y-1/2',
              )}
              style={hour > 0 && hour < 18 ? { top: `${(hour / 18) * 100}%` } : undefined}
            >
              {formatScheduleMinutes(hour * 60)}
            </span>
          ))}
        </div>
      </div>
      <div
        ref={scrollerRef}
        data-testid="schedule-scroll"
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
      >
        <div className="flex h-full w-max">
          {snapshot.dealers.map((dealer) => (
            <div
              key={dealer.id}
              className="flex h-full w-[120px] shrink-0 flex-col border-l border-white/10"
            >
              <div className="flex h-9 shrink-0 items-center justify-center border-b border-white/10 text-sm font-semibold">
                {dealer.displayName}
              </div>
              <div data-track={dealer.id} className="relative min-h-0 flex-1 bg-white/[0.02]">
                {HOURS.slice(0, 18).map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-white/10"
                    style={{ top: `${(hour / 18) * 100}%` }}
                  />
                ))}
                {paint(dealer.id).map((shift) => (
                  <div
                    key={shift.id}
                    data-shift-id={shift.preview ? undefined : shift.id}
                    className={cx(
                      'absolute inset-x-1 z-10 overflow-hidden rounded-md border px-1 py-0.5 text-[10px] leading-tight text-white',
                      shift.kind === 'cash'
                        ? 'border-emerald-200/70 bg-emerald-600/90'
                        : 'border-violet-200/70 bg-violet-600/90',
                      shift.preview && 'cursor-grabbing opacity-90',
                      !shift.preview && 'cursor-grab',
                      shift.preview && draftInvalid && 'border-rose-200 bg-rose-600/90',
                    )}
                    style={blockStyle(shift.startMinutes, shift.endMinutes)}
                  >
                    <span className="block font-semibold">
                      {shift.kind === 'cash' ? 'Cash' : 'Tournoi'}
                    </span>
                    <span className="block tabular-nums">
                      {formatScheduleMinutes(shift.startMinutes)}–
                      {formatScheduleMinutes(shift.endMinutes)}
                    </span>
                    {!shift.preview ? (
                      <button
                        type="button"
                        data-remove
                        aria-label={`Retirer le quart de ${dealer.displayName}`}
                        className="absolute top-0.5 right-0.5 grid h-4 w-4 place-items-center rounded bg-black/25 text-[11px] leading-none"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => room.removeScheduleShift(shift.id)}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
