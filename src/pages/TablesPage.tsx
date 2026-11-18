import { PageHeader } from '../components/layout/PageHeader.tsx'
import { useRoom } from '../features/room/RoomContext.tsx'
import { btnDanger, btnGood, btnPrimary } from '../utils/cx.ts'
import { GAME_TYPE_LABEL, categoryColor } from '../utils/labels.ts'

export function TablesPage() {
  const { snapshot, select, openTable, closeTable, setGameType } = useRoom()
  if (!snapshot) return null
  const tables = [...snapshot.tables].sort((a, b) =>
    a.id.localeCompare(b.id, 'fr', { numeric: true }),
  )

  return (
    <div className="flex flex-col gap-3 p-3 lg:p-4">
      <PageHeader
        title="Tables"
        subtitle="Onze tables physiques. Ouvrir demande un type de jeu. Fermer retire le croupier."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => (
          <article key={table.id} className="rounded-2xl border border-white/10 bg-[#141226] p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => select({ type: 'table', id: table.id })}
            >
              <span className="font-display text-lg font-semibold">{table.id}</span>
              <span className="inline-flex items-center gap-2 text-sm text-violet-100/70">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: categoryColor(table) }}
                />
                {table.status === 'closed' ? 'Fermée' : GAME_TYPE_LABEL[table.gameType]}
              </span>
            </button>
            <p className="mt-1 text-sm text-violet-100/70">
              {table.dealerId ? `Croupier ${table.dealerId}` : 'Sans croupier'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {table.status === 'closed' ? (
                <>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => openTable(table.id, 'tournament')}
                  >
                    Ouvrir tournoi
                  </button>
                  <button
                    type="button"
                    className={btnGood}
                    onClick={() => openTable(table.id, 'cash')}
                  >
                    Ouvrir cash
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() =>
                      setGameType(table.id, table.gameType === 'cash' ? 'tournament' : 'cash')
                    }
                  >
                    {table.gameType === 'cash' ? 'Passer en tournoi' : 'Passer en cash'}
                  </button>
                  <button type="button" className={btnDanger} onClick={() => closeTable(table.id)}>
                    Fermer
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
