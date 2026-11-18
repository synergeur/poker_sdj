import { Lock, Map } from 'lucide-react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import type { PokerTable } from '../../types/room.ts'
import { cx } from '../../utils/cx.ts'
import { GAME_TYPE_LABEL, categoryColor } from '../../utils/labels.ts'

function PokerTableButton({ table }: { table: PokerTable }) {
  const { selection, select } = useRoom()
  const selected = selection?.type === 'table' && selection.id === table.id
  const color = categoryColor(table)
  const closed = table.status === 'closed'
  const gap = table.status === 'open' && !table.dealerId
  const typeLabel = closed ? 'Fermé' : GAME_TYPE_LABEL[table.gameType]
  const dealerLabel = closed ? 'Fermée' : table.dealerId ? table.dealerId : 'Sans croupier'

  return (
    <button
      type="button"
      data-testid={`table-${table.id}`}
      aria-pressed={selected}
      aria-label={`Table ${table.id}, ${typeLabel}, ${dealerLabel}`}
      onClick={() => select({ type: 'table', id: table.id })}
      className={cx(
        'relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-full border-[3px] px-2 text-center',
        closed && 'opacity-80',
        selected && 'outline-2 outline-offset-[3px] outline-white',
      )}
      style={{
        borderColor: color,
        borderStyle: gap ? 'dashed' : 'solid',
        background: 'radial-gradient(ellipse at 50% 38%, #3a3a3a 0%, #1a1a1a 55%, #070707 100%)',
        boxShadow: `0 12px 22px rgba(0,0,0,0.38), 0 0 16px ${color}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
      }}
    >
      <span
        className="absolute top-[16%] right-[16%] h-2.5 w-2.5 rounded-full border border-black/50"
        style={{ background: table.timelineColor }}
        title="Couleur de cette table dans la frise"
      />
      {closed ? <Lock size={13} className="absolute top-[18%] left-[18%] text-slate-300" /> : null}
      <span className="font-display truncate text-xs font-semibold tracking-wide text-white">
        {table.id}
      </span>
      <span className="truncate text-[10px] tracking-[0.12em] text-white/70 uppercase">
        {typeLabel}
      </span>
      <span className={cx('text-xs font-semibold', gap ? 'text-amber-200' : 'text-white')}>
        {closed ? '—' : dealerLabel}
      </span>
    </button>
  )
}

const SEAT_START = [
  '',
  'col-start-1',
  'col-start-2',
  'col-start-3',
  'col-start-4',
  'col-start-5',
  'col-start-6',
]

function Row({ tables, alignRight = false }: { tables: PokerTable[]; alignRight?: boolean }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-6 gap-2">
      {tables.map((table) => (
        <div
          key={table.id}
          className={alignRight ? `min-h-0 ${SEAT_START[table.seat]}` : 'min-h-0'}
        >
          <PokerTableButton table={table} />
        </div>
      ))}
    </div>
  )
}

export function FloorPlan() {
  const { snapshot } = useRoom()
  if (!snapshot) return null
  const top = snapshot.tables.filter((table) => table.row === 'top').sort((a, b) => a.seat - b.seat)
  const bottom = snapshot.tables
    .filter((table) => table.row === 'bottom')
    .sort((a, b) => a.seat - b.seat)
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-amber-100/10 bg-[#1a100c] p-2 shadow-inner">
      <header className="mb-1 flex shrink-0 items-center justify-between gap-2 text-amber-50">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <Map size={15} />
          Plan de salle
        </h2>
        <p className="truncate text-[11px] text-amber-100/60">
          Cliquez une table. Le contour est le type de jeu, la pastille est la couleur de la frise.
        </p>
      </header>
      <div className="grid min-h-0 flex-1 grid-rows-2 gap-2 overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,196,120,0.18),transparent_42%),radial-gradient(ellipse_at_80%_100%,rgba(120,50,20,0.35),transparent_40%),linear-gradient(180deg,#4a2c1c,#1a0e0a)] p-2">
        <Row tables={top} />
        <Row tables={bottom} alignRight />
      </div>
    </section>
  )
}
