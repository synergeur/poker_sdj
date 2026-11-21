import { PageHeader } from '../components/layout/PageHeader.tsx'
import { ScheduleGrid } from '../components/schedule/ScheduleGrid.tsx'

export function SchedulesPage() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <PageHeader
        title="Horaires"
        subtitle="De 10:00 à 04:00. Clic gauche et glisser : cash. Clic droit et glisser : tournoi. Glissez un bloc pour le déplacer."
      />
      <div className="flex shrink-0 items-center gap-4 text-xs text-violet-100/70">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Cash game
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
          Tournoi
        </span>
        <span>Les heures restent visibles. Le défilement montre les autres croupiers.</span>
      </div>
      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#100c1e]">
        <ScheduleGrid />
      </section>
    </div>
  )
}
