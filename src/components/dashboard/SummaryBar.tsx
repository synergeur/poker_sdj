import { Coffee, Lock, Spade, Timer, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import { summarize } from '../../features/room/summary.ts'
import { ROTATION_MODE_LABEL } from '../../utils/labels.ts'

export function SummaryBar() {
  const { snapshot } = useRoom()
  if (!snapshot) return null
  const summary = summarize(snapshot)
  const mode = ROTATION_MODE_LABEL[snapshot.settings.rotationMode]

  const cards: Array<{
    id: string
    label: string
    value: string
    detail: string
    icon: LucideIcon
    tint: string
  }> = [
    {
      id: 'summary-tournament',
      label: 'Tournois',
      value: `${summary.tournamentTables} tables`,
      detail: 'Ouvertes',
      icon: Spade,
      tint: 'bg-violet-500/20 text-violet-200',
    },
    {
      id: 'summary-cash',
      label: 'Cash Game',
      value: `${summary.cashTables} tables`,
      detail: 'Ouvertes',
      icon: Wallet,
      tint: 'bg-emerald-500/20 text-emerald-200',
    },
    {
      id: 'summary-closed',
      label: 'Non ouvertes',
      value: `${summary.closedTables} tables`,
      detail: 'Fermées',
      icon: Lock,
      tint: 'bg-slate-500/20 text-slate-200',
    },
    {
      id: 'summary-dealers',
      label: 'Croupiers en salle',
      value: String(summary.dealersInRoom),
      detail: `${summary.dealersAssigned} affectés`,
      icon: Users,
      tint: 'bg-sky-500/20 text-sky-200',
    },
    {
      id: 'summary-break',
      label: 'En pause',
      value: String(summary.dealersOnBreak),
      detail: summary.dealersOnBreak === 0 ? 'Aucune pause' : 'À suivre',
      icon: Coffee,
      tint: 'bg-amber-400/20 text-amber-200',
    },
    {
      id: 'summary-interval',
      label: 'Intervalle',
      value: `${snapshot.settings.rotationIntervalMinutes} min`,
      detail: `${mode} · inactif`,
      icon: Timer,
      tint: 'bg-fuchsia-500/20 text-fuchsia-200',
    },
  ]

  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <article
            key={card.id}
            data-testid={card.id}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#16122b] px-3 py-2.5"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${card.tint}`}>
              <Icon size={16} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] tracking-wide text-violet-100/60 uppercase">
                {card.label}
              </span>
              <span className="font-display block text-base leading-tight font-semibold text-white">
                {card.value}
              </span>
              <span className="block truncate text-[11px] text-violet-100/50">{card.detail}</span>
            </span>
          </article>
        )
      })}
      {summary.openWithoutDealer > 0 ? (
        <p
          data-testid="summary-gap"
          className="col-span-full rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
        >
          {summary.openWithoutDealer} table{summary.openWithoutDealer > 1 ? 's' : ''} ouverte
          {summary.openWithoutDealer > 1 ? 's' : ''} sans croupier.
        </p>
      ) : null}
    </section>
  )
}
