import { ChartColumn, LayoutGrid, Radio, RefreshCcw, Settings, Spade, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { useRoom } from '../../features/room/RoomContext.tsx'
import { cx } from '../../utils/cx.ts'
import { Inspector } from '../inspector/Inspector.tsx'

const NAV = [
  { to: '/', label: 'Salle en direct', icon: Radio, end: true },
  { to: '/rotations', label: 'Rotations & pauses', icon: RefreshCcw, end: false },
  { to: '/dealers', label: 'Croupiers', icon: Users, end: false },
  { to: '/tables', label: 'Tables', icon: LayoutGrid, end: false },
  { to: '/reports', label: 'Rapports', icon: ChartColumn, end: false },
  { to: '/settings', label: 'Paramètres', icon: Settings, end: false },
]

export function AppShell() {
  const { ready, snapshot, notice, clearNotice, conflicts, setRoomOpen } = useRoom()
  const roomOpen = snapshot?.settings.roomOpen ?? false

  return (
    <div className="flex h-dvh max-h-dvh w-full max-w-full overflow-hidden bg-[#090712] text-violet-50">
      <aside className="flex h-full w-[92px] shrink-0 flex-col overflow-hidden border-r border-violet-200/10 bg-[#120a22]">
        <div className="flex shrink-0 flex-col items-center gap-2 px-2 pt-3 pb-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-900/40">
            <Spade size={18} />
          </span>
          <span className="text-center leading-tight">
            <span className="block text-[10px] tracking-[0.16em] text-violet-200/70 uppercase">
              Salon de jeu
            </span>
            <span className="font-display text-sm font-semibold">Poker</span>
          </span>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-testid={`nav-${item.to}`}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-center text-[11px] leading-tight text-violet-100/75 transition hover:bg-white/5 hover:text-white',
                    isActive && 'bg-violet-600 text-white shadow-md shadow-violet-950/40',
                  )
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <button
          type="button"
          onClick={() => setRoomOpen(!roomOpen)}
          className="m-2 flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 px-2 py-2 text-[11px] font-semibold"
        >
          <span
            className={cx('h-2 w-2 rounded-full', roomOpen ? 'bg-emerald-400' : 'bg-rose-400')}
          />
          {roomOpen ? 'Salle ouverte' : 'Salle fermée'}
        </button>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {notice ? (
          <div
            role="status"
            data-testid="notice"
            className="mx-3 mt-2 flex shrink-0 items-start justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-sm text-amber-50"
          >
            <p>{notice}</p>
            <button
              type="button"
              className="shrink-0 font-semibold underline"
              onClick={clearNotice}
            >
              Fermer
            </button>
          </div>
        ) : null}
        {conflicts.length > 0 ? (
          <div
            role="alert"
            className="mx-3 mt-2 shrink-0 rounded-xl border border-rose-300/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-50"
          >
            Incohérence d'affectation : {conflicts.join(' ')}
          </div>
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {!ready ? (
            <p className="p-6 text-sm text-violet-200/70">Chargement de la salle…</p>
          ) : (
            <div className="h-full min-h-0 min-w-0 overflow-hidden">
              <Outlet />
            </div>
          )}
        </main>
      </div>
      <Inspector />
    </div>
  )
}
