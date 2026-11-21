import { useMemo, useState } from 'react'
import { DealerFile } from '../components/dealers/DealerFile.tsx'
import { PageHeader } from '../components/layout/PageHeader.tsx'
import { useRoom } from '../features/room/RoomContext.tsx'
import type { Dealer, DealerStatus } from '../types/room.ts'
import { cx } from '../utils/cx.ts'
import { DEALER_STATUS_LABEL, WEEKDAY_SHORT } from '../utils/labels.ts'

const FILTERS: Array<{ id: 'all' | DealerStatus; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'assigned', label: 'Affectés' },
  { id: 'on_break', label: 'En pause' },
  { id: 'available', label: 'Disponibles' },
  { id: 'off_shift', label: 'Hors quart' },
]

function averageScore(dealer: Dealer): string | null {
  if (dealer.evaluations.length === 0) return null
  const total = dealer.evaluations.reduce((sum, item) => sum + item.score, 0)
  return (total / dealer.evaluations.length).toFixed(1).replace('.', ',')
}

export function DealersPage() {
  const { snapshot } = useRoom()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dealers = useMemo(() => {
    if (!snapshot) return []
    return snapshot.dealers.filter((dealer) => {
      const matchesFilter = filter === 'all' || dealer.status === filter
      const matchesQuery = dealer.displayName.toLowerCase().includes(query.trim().toLowerCase())
      return matchesFilter && matchesQuery
    })
  }, [filter, query, snapshot])

  if (!snapshot) return null
  const selected = snapshot.dealers.find((dealer) => dealer.id === selectedId) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <PageHeader
        title="Croupiers"
        subtitle="Fiches : horaires possibles, évaluations et commentaires."
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <section
          className={cx(
            'flex min-h-0 flex-col gap-2 overflow-hidden',
            selected && 'hidden lg:flex',
          )}
        >
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <input
              id="dealer-search"
              name="dealer-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher CC63…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#141226] px-3 py-2 text-sm"
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
              className="min-h-0 flex-1 space-y-2 overflow-auto overscroll-contain pr-1"
              data-testid="dealer-scroll"
              aria-label="Liste des croupiers"
            >
              {dealers.map((dealer) => {
                const score = averageScore(dealer)
                const aware = dealer.comments.filter((item) => item.dealerAware).length
                return (
                  <button
                    key={dealer.id}
                    type="button"
                    data-testid={`dealer-card-${dealer.id}`}
                    onClick={() => setSelectedId(dealer.id)}
                    className={cx(
                      'block w-full rounded-2xl border px-3 py-3 text-left transition',
                      selectedId === dealer.id
                        ? 'border-violet-400 bg-violet-600/20'
                        : 'border-white/10 bg-[#141226] hover:border-violet-300/40',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-semibold">
                        {dealer.displayName}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                        {DEALER_STATUS_LABEL[dealer.status]}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-violet-100/70">
                      {dealer.currentTableId ?? 'Sans table'}
                    </span>
                    <span className="mt-2 block text-xs text-violet-100/60">
                      {dealer.availability.length === 0
                        ? 'Horaires non renseignés'
                        : dealer.availability
                            .slice(0, 3)
                            .map((slot) => `${WEEKDAY_SHORT[slot.day]} ${slot.start}–${slot.end}`)
                            .join(' · ')}
                      {dealer.availability.length > 3
                        ? ` · +${dealer.availability.length - 3}`
                        : ''}
                    </span>
                    <span className="mt-2 flex gap-3 text-xs text-violet-100/55">
                      <span>{score ? `Éval. ${score}/5` : 'Sans évaluation'}</span>
                      <span>
                        {dealer.comments.length} commentaire{dealer.comments.length > 1 ? 's' : ''}
                        {dealer.comments.length > 0 ? ` · ${aware} au courant` : ''}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
        <section
          className={cx(
            'min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#100c1e]',
            selected ? 'flex' : 'hidden lg:block',
          )}
        >
          {selected ? (
            <DealerFile dealerId={selected.id} onBack={() => setSelectedId(null)} />
          ) : (
            <p className="p-6 text-sm text-violet-100/70">
              Choisissez un croupier pour voir ses horaires, ses évaluations et ses commentaires.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
