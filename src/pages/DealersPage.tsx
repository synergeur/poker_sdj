import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.tsx'
import { useRoom } from '../features/room/RoomContext.tsx'
import type { DealerStatus } from '../types/room.ts'
import { cx } from '../utils/cx.ts'
import { DEALER_STATUS_LABEL } from '../utils/labels.ts'

const FILTERS: Array<{ id: 'all' | DealerStatus; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'assigned', label: 'Affectés' },
  { id: 'on_break', label: 'En pause' },
  { id: 'available', label: 'Disponibles' },
  { id: 'off_shift', label: 'Hors quart' },
]

export function DealersPage() {
  const { snapshot, select, setDealerStatus, unassignDealer } = useRoom()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const dealers = useMemo(() => {
    if (!snapshot) return []
    return snapshot.dealers.filter((dealer) => {
      const matchesFilter = filter === 'all' || dealer.status === filter
      const matchesQuery = dealer.displayName.toLowerCase().includes(query.trim().toLowerCase())
      return matchesFilter && matchesQuery
    })
  }, [filter, query, snapshot])

  if (!snapshot) return null

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <PageHeader
        title="Croupiers"
        subtitle="Onze identifiants fictifs. Le statut change tout de suite le plan de salle et la frise."
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          id="dealer-search"
          name="dealer-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher CC63…"
          className="rounded-xl border border-white/10 bg-[#141226] px-3 py-2 text-sm"
          aria-label="Rechercher un croupier"
        />
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cx(
              'rounded-full px-3 py-1.5 text-sm',
              filter === item.id ? 'bg-violet-600 text-white' : 'bg-white/5 text-violet-100/70',
            )}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {dealers.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#141226] p-6 text-sm text-violet-100/70">
          Aucun croupier ne correspond à ce filtre.
        </p>
      ) : (
        <div
          className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-white/10"
          data-testid="dealer-scroll"
          aria-label="Liste des croupiers"
        >
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#1b1630] text-[11px] tracking-wide text-violet-100/50 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Croupier</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Table</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map((dealer) => (
                <tr key={dealer.id} className="border-t border-white/5 bg-[#141226]">
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="font-semibold hover:underline"
                      onClick={() => select({ type: 'dealer', id: dealer.id })}
                    >
                      {dealer.displayName}
                    </button>
                  </td>
                  <td className="px-3 py-2">{DEALER_STATUS_LABEL[dealer.status]}</td>
                  <td className="px-3 py-2">{dealer.currentTableId ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {dealer.status === 'on_break' ? (
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold"
                          onClick={() => setDealerStatus(dealer.id, 'available')}
                        >
                          Fin de pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg bg-amber-400 px-2 py-1 text-xs font-semibold text-amber-950"
                          onClick={() => setDealerStatus(dealer.id, 'on_break')}
                        >
                          Pause
                        </button>
                      )}
                      {dealer.currentTableId ? (
                        <button
                          type="button"
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs"
                          onClick={() => unassignDealer(dealer.currentTableId!)}
                        >
                          Retirer
                        </button>
                      ) : null}
                      {dealer.status === 'off_shift' ? (
                        <button
                          type="button"
                          className="rounded-lg bg-violet-600 px-2 py-1 text-xs"
                          onClick={() => setDealerStatus(dealer.id, 'available')}
                        >
                          En salle
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs"
                          onClick={() => setDealerStatus(dealer.id, 'off_shift')}
                        >
                          Hors quart
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
