import { Ban, Coffee } from 'lucide-react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import { ROTATION_INTERVALS, type RotationInterval } from '../../types/room.ts'
import { cx } from '../../utils/cx.ts'
import { GAME_TYPE_LABEL, ROTATION_MODE_LABEL } from '../../utils/labels.ts'
import { formatTime } from '../../utils/time.ts'

export function RotationControls() {
  const { snapshot, setRotationMode, setRotationInterval } = useRoom()
  if (!snapshot) return null
  const { rotationMode, rotationIntervalMinutes } = snapshot.settings

  return (
    <section className="rounded-2xl border border-violet-300/20 bg-[#1a1333] p-3">
      <h2 className="font-display text-base font-semibold">Contrôle de la rotation</h2>
      <p className="mt-1 text-xs text-violet-100/60">
        Le mode et l'intervalle sont mémorisés. Aucun cycle ne s'exécute dans ce prototype.
      </p>
      <div className="mt-3 grid grid-cols-2 rounded-xl bg-black/30 p-1 text-sm">
        <button
          type="button"
          data-testid="mode-auto"
          className={cx(
            'rounded-lg px-2 py-1.5 font-semibold',
            rotationMode === 'auto' ? 'bg-violet-600 text-white' : 'text-violet-100/70',
          )}
          onClick={() => setRotationMode('auto')}
        >
          Automatique
        </button>
        <button
          type="button"
          data-testid="mode-manual"
          className={cx(
            'rounded-lg px-2 py-1.5 font-semibold',
            rotationMode === 'manual' ? 'bg-violet-600 text-white' : 'text-violet-100/70',
          )}
          onClick={() => setRotationMode('manual')}
        >
          Manuel
        </button>
      </div>
      <p className="mt-3 text-[11px] tracking-wide text-violet-100/50 uppercase">Intervalle</p>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {ROTATION_INTERVALS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            data-testid={`interval-${minutes}`}
            className={cx(
              'rounded-lg px-1 py-1.5 text-xs font-semibold',
              rotationIntervalMinutes === minutes
                ? 'bg-violet-500 text-white'
                : 'bg-white/5 text-violet-100/70',
            )}
            onClick={() => setRotationInterval(minutes as RotationInterval)}
          >
            {minutes} min
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-violet-100/35"
        >
          Démarrer la rotation
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-violet-100/35"
        >
          Mettre la rotation en pause
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-violet-100/35"
        >
          <Ban size={14} />
          Chip run — non défini
        </button>
      </div>
      <p className="mt-3 text-xs text-violet-100/55">
        Mode affiché : {ROTATION_MODE_LABEL[rotationMode]} · {rotationIntervalMinutes} min ·
        inactif. Pour déplacer quelqu'un, ouvrez sa table ou sa fiche.
      </p>
    </section>
  )
}

export function UpcomingPanel() {
  const { snapshot, select } = useRoom()
  if (!snapshot) return null
  const assignments = snapshot.tables.filter((table) => table.dealerId)
  const breaks = snapshot.dealers.filter((dealer) => dealer.status === 'on_break')
  const gaps = snapshot.tables.filter((table) => table.status === 'open' && !table.dealerId)

  return (
    <section className="rounded-2xl border border-white/10 bg-[#141226] p-3">
      <h2 className="font-display text-base font-semibold">Prochaine rotation</h2>
      <p className="mt-1 text-sm text-violet-100/80">
        Non calculée · repère {formatTime(snapshot.clock)}
      </p>
      <p className="mt-1 text-xs text-violet-100/55">
        Les flèches du type HN-02 → HN-04 apparaîtront ici lorsque les règles de rotation seront
        définies. Rien n'est inventé en attendant.
      </p>
      <h3 className="mt-3 text-[11px] tracking-wide text-violet-100/50 uppercase">En ce moment</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {assignments.map((table) => (
          <li key={table.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-white/5"
              onClick={() => select({ type: 'table', id: table.id })}
            >
              <span>{table.dealerId}</span>
              <span className="font-semibold">{table.id}</span>
            </button>
          </li>
        ))}
      </ul>
      <h3 className="mt-3 text-[11px] tracking-wide text-amber-100/70 uppercase">Pauses</h3>
      {breaks.length === 0 ? (
        <p className="mt-1 text-sm text-violet-100/55">Aucun croupier en pause.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {breaks.map((dealer) => (
            <li key={dealer.id}>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5"
                onClick={() => select({ type: 'dealer', id: dealer.id })}
              >
                <Coffee size={14} className="text-amber-300" />
                {dealer.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {gaps.length > 0 ? (
        <p className="mt-3 text-sm text-amber-100">
          Sans croupier : {gaps.map((table) => table.id).join(', ')}
        </p>
      ) : null}
    </section>
  )
}

export function TableLegend() {
  const { snapshot } = useRoom()
  if (!snapshot) return null
  const groups = [
    {
      title: 'Tournois',
      swatch: 'bg-violet-500',
      tables: snapshot.tables.filter(
        (table) => table.status === 'open' && table.gameType === 'tournament',
      ),
    },
    {
      title: 'Cash Game',
      swatch: 'bg-emerald-500',
      tables: snapshot.tables.filter(
        (table) => table.status === 'open' && table.gameType === 'cash',
      ),
    },
    {
      title: 'Non ouvertes',
      swatch: 'bg-slate-500',
      tables: snapshot.tables.filter((table) => table.status === 'closed'),
    },
  ]

  return (
    <section className="rounded-2xl border border-white/10 bg-[#141226] p-3">
      <h2 className="font-display text-base font-semibold">Légende des tables</h2>
      <p className="mt-1 text-xs text-violet-100/55">
        Le contour du plan suit la catégorie ({GAME_TYPE_LABEL.tournament.toLowerCase()}, cash,
        fermée). Chaque pastille est la couleur de la table dans la frise.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {groups.map((group) => (
          <li key={group.title}>
            <p className="flex items-center gap-2 font-semibold">
              <span className={`h-2.5 w-2.5 rounded-full ${group.swatch}`} />
              {group.title}
            </p>
            <p className="pl-4 text-violet-100/60">
              {group.tables.length === 0
                ? 'Aucune'
                : group.tables.map((table) => table.id).join(', ')}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {snapshot.tables.map((table) => (
          <span
            key={table.id}
            className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[11px]"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: table.timelineColor }} />
            {table.id}
          </span>
        ))}
      </div>
    </section>
  )
}
