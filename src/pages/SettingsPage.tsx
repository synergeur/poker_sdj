import { dataSourceLabel, env, isFirebaseConfigured } from '../config/env.ts'
import { isRoomOpen } from '../features/room/summary.ts'
import { SimClockBar } from '../components/dashboard/SimClockBar.tsx'
import { PageHeader } from '../components/layout/PageHeader.tsx'
import { useRoom } from '../features/room/RoomContext.tsx'
import { btnDanger } from '../utils/cx.ts'
import { PROTOTYPE_RULES, ROTATION_MODE_LABEL } from '../utils/labels.ts'

export function SettingsPage() {
  const { snapshot, resetScenario } = useRoom()
  if (!snapshot) return null

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <PageHeader
        title="Paramètres"
        subtitle="Ce qui est branché aujourd'hui, et les règles temporaires du prototype."
      />
      <div className="min-h-0 flex-1 space-y-2 overflow-auto overscroll-contain">
        <SimClockBar />
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">Environnement</h2>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-violet-100/60">Application</dt>
              <dd>{env.appName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-violet-100/60">Environnement</dt>
              <dd>{env.appEnv}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-violet-100/60">Données fictives</dt>
              <dd>{env.useMockData ? 'oui' : 'non'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-violet-100/60">Firebase activé</dt>
              <dd>{env.enableFirebase ? 'oui' : 'non'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-violet-100/60">Configuration Firebase</dt>
              <dd>{isFirebaseConfigured() ? 'présente' : 'absente'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-violet-100/70">{dataSourceLabel()}</p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">Préférences mémorisées</h2>
          <p className="mt-2 text-sm text-violet-100/70">
            Mode {ROTATION_MODE_LABEL[snapshot.settings.rotationMode]}, intervalle{' '}
            {snapshot.settings.rotationIntervalMinutes} min. Ces valeurs ne déclenchent pas de
            rotation. La salle est {isRoomOpen(snapshot.tables) ? 'ouverte' : 'fermée'} parce que{' '}
            {isRoomOpen(snapshot.tables)
              ? 'au moins une table est ouverte.'
              : 'toutes les tables sont fermées.'}
          </p>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">Règles de ce prototype</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-violet-100/80">
            {PROTOTYPE_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-rose-300/20 bg-[#141226] p-4">
          <h2 className="font-display text-lg font-semibold">Scénario</h2>
          <p className="mt-2 text-sm text-violet-100/70">
            Réinitialiser revient au plan de départ : lundi 17 novembre 2026, 19:44, sept croupiers
            en place. Le registre de ce navigateur est effacé.
          </p>
          <button type="button" className={`${btnDanger} mt-3`} onClick={resetScenario}>
            Réinitialiser le scénario
          </button>
        </section>
      </div>
    </div>
  )
}
