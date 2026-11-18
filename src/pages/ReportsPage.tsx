import { PageHeader } from '../components/layout/PageHeader.tsx'
import { useRoom } from '../features/room/RoomContext.tsx'
import { summarize } from '../features/room/summary.ts'

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 py-2 text-sm">
      <dt className="text-violet-100/65">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  )
}

export function ReportsPage() {
  const { snapshot, select } = useRoom()
  if (!snapshot) return null
  const summary = summarize(snapshot)
  const gaps = snapshot.tables.filter((table) => table.status === 'open' && !table.dealerId)
  const breaks = snapshot.dealers.filter((dealer) => dealer.status === 'on_break')
  const offShift = snapshot.dealers.filter((dealer) => dealer.status === 'off_shift')

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <PageHeader
        title="Aperçu du quart"
        subtitle="Comptages issus de l'état actuel. Pas de rapport financier, pas de paie, pas d'historique de production."
      />
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-auto overscroll-contain lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">Salle</h2>
          <dl>
            <Line label="Tables tournoi ouvertes" value={String(summary.tournamentTables)} />
            <Line label="Tables cash ouvertes" value={String(summary.cashTables)} />
            <Line label="Tables fermées" value={String(summary.closedTables)} />
            <Line label="Tables ouvertes sans croupier" value={String(summary.openWithoutDealer)} />
            <Line label="Croupiers en salle" value={String(summary.dealersInRoom)} />
            <Line label="Croupiers affectés" value={String(summary.dealersAssigned)} />
            <Line label="Croupiers disponibles" value={String(summary.dealersAvailable)} />
            <Line label="Croupiers en pause" value={String(summary.dealersOnBreak)} />
            <Line label="Croupiers hors quart" value={String(summary.dealersOffShift)} />
          </dl>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">À regarder</h2>
          <h3 className="mt-3 text-sm font-semibold text-amber-100">Tables sans croupier</h3>
          {gaps.length === 0 ? (
            <p className="mt-1 text-sm text-violet-100/60">
              Toutes les tables ouvertes ont un croupier.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {gaps.map((table) => (
                <li key={table.id}>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => select({ type: 'table', id: table.id })}
                  >
                    {table.id}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-sm font-semibold text-amber-100">Pauses en cours</h3>
          {breaks.length === 0 ? (
            <p className="mt-1 text-sm text-violet-100/60">Aucune pause en cours.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {breaks.map((dealer) => (
                <li key={dealer.id}>
                  <button
                    type="button"
                    className="text-sm underline"
                    onClick={() => select({ type: 'dealer', id: dealer.id })}
                  >
                    {dealer.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-sm font-semibold">Hors quart</h3>
          {offShift.length === 0 ? (
            <p className="mt-1 text-sm text-violet-100/60">Tout le monde est encore en salle.</p>
          ) : (
            <p className="mt-1 text-sm">
              {offShift.map((dealer) => dealer.displayName).join(', ')}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
