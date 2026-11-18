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
        'relative flex aspect-[2.15/1] w-full min-w-[112px] flex-col items-center justify-center rounded-full border-[3px] px-3 text-center transition hover:-translate-y-0.5',
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
      <span className="font-display text-sm font-semibold tracking-wide text-white md:text-base">
        {table.id}
      </span>
      <span className="text-[10px] tracking-[0.14em] text-white/70 uppercase">{typeLabel}</span>
      <span className={cx('text-xs font-semibold', gap ? 'text-amber-200' : 'text-white')}>
        {closed ? '—' : dealerLabel}
      </span>
    </button>
  )
}

const SEAT_START = [
  '',
  'lg:col-start-1',
  'lg:col-start-2',
  'lg:col-start-3',
  'lg:col-start-4',
  'lg:col-start-5',
  'lg:col-start-6',
]

function Row({ tables, alignRight = false }: { tables: PokerTable[]; alignRight?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tables.map((table) => (
        <div key={table.id} className={alignRight ? SEAT_START[table.seat] : undefined}>
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
    <section className="rounded-2xl border border-amber-100/10 bg-[#1a100c] p-3 shadow-inner md:p-4">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2 text-amber-50">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Map size={16} />
            Plan de salle
          </h2>
          <p className="text-xs text-amber-100/60">
            Cliquez une table pour l'ouvrir, la fermer ou changer son croupier. Le contour suit le
            type de jeu. La pastille est la couleur unique de la frise.
          </p>
        </div>
      </header>
      <div className="rounded-xl bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,196,120,0.18),transparent_42%),radial-gradient(ellipse_at_80%_100%,rgba(120,50,20,0.35),transparent_40%),linear-gradient(180deg,#4a2c1c,#1a0e0a)] p-3 md:p-4">
        <Row tables={top} />
        <div className="mt-3 lg:mt-4">
          <Row tables={bottom} alignRight />
        </div>
      </div>
    </section>
  )
}
