import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import { btnDanger, btnGhost, btnGood, btnPrimary, btnWarn, cx } from '../../utils/cx.ts'
import { DEALER_STATUS_LABEL, GAME_TYPE_LABEL, tableStatusLabel } from '../../utils/labels.ts'

export function Inspector() {
  const room = useRoom()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { selection, select, snapshot } = room

  useEffect(() => {
    if (!selection) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select, selection])

  if (!selection || !snapshot) return null

  const table =
    selection.type === 'table' ? snapshot.tables.find((item) => item.id === selection.id) : null
  const dealer =
    selection.type === 'dealer' ? snapshot.dealers.find((item) => item.id === selection.id) : null
  if (!table && !dealer) return null

  const title = table ? table.id : dealer?.displayName
  const availableDealers = snapshot.dealers.filter((item) => item.status === 'available')
  const openGaps = snapshot.tables.filter((item) => item.status === 'open' && !item.dealerId)

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => select(null)}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
        data-testid="inspector"
        className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#120d22] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4">
          <div>
            <p className="text-[11px] tracking-[0.14em] text-violet-200/50 uppercase">
              {table ? 'Table' : 'Croupier'}
            </p>
            <h2 id="inspector-title" className="font-display text-2xl font-semibold">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="rounded-lg border border-white/10 p-2"
            onClick={() => select(null)}
            aria-label="Fermer le panneau"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {table ? (
            <>
              <p className="text-sm text-violet-100/75">{tableStatusLabel(table)}</p>
              <p className="flex items-center gap-2 text-sm">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: table.timelineColor }}
                />
                Couleur de frise propre à {table.id}
              </p>
              {table.status === 'closed' ? (
                <div className="grid gap-2">
                  <button
                    type="button"
                    data-testid="open-tournament"
                    className={btnPrimary}
                    onClick={() => room.openTable(table.id, 'tournament')}
                  >
                    Ouvrir en tournoi
                  </button>
                  <button
                    type="button"
                    data-testid="open-cash"
                    className={btnGood}
                    onClick={() => room.openTable(table.id, 'cash')}
                  >
                    Ouvrir en cash game
                  </button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() =>
                      room.setGameType(
                        table.id,
                        table.gameType === 'tournament' ? 'cash' : 'tournament',
                      )
                    }
                  >
                    Passer en {table.gameType === 'tournament' ? 'cash game' : 'tournoi'}
                  </button>
                  <button
                    type="button"
                    data-testid="close-table"
                    className={btnDanger}
                    onClick={() => room.closeTable(table.id)}
                  >
                    Fermer la table
                  </button>
                </div>
              )}
              <section>
                <h3 className="text-sm font-semibold">Croupier</h3>
                {table.dealerId ? (
                  <div className="mt-2 grid gap-2">
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => select({ type: 'dealer', id: table.dealerId! })}
                    >
                      Voir {table.dealerId}
                    </button>
                    <button
                      type="button"
                      data-testid="unassign-dealer"
                      className={btnGhost}
                      onClick={() => room.unassignDealer(table.id)}
                    >
                      Retirer le croupier
                    </button>
                    <button
                      type="button"
                      data-testid="send-break"
                      className={btnWarn}
                      onClick={() => room.setDealerStatus(table.dealerId!, 'on_break')}
                    >
                      Envoyer en pause
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => room.setDealerStatus(table.dealerId!, 'off_shift')}
                    >
                      Terminer le quart
                    </button>
                  </div>
                ) : table.status === 'closed' ? (
                  <p className="mt-1 text-sm text-violet-100/60">
                    Ouvrez la table pour y placer quelqu'un.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableDealers.length === 0 ? (
                      <p className="text-sm text-violet-100/60">Aucun croupier disponible.</p>
                    ) : (
                      availableDealers.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`assign-${item.id}`}
                          className={btnPrimary}
                          onClick={() => room.assignDealer(table.id, item.id)}
                        >
                          Affecter {item.displayName}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </section>
              <p className="text-xs text-violet-100/50">
                Les prochaines rotations de cette table ne sont pas calculées.
              </p>
            </>
          ) : dealer ? (
            <>
              <p
                className={cx(
                  'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                  dealer.status === 'assigned' && 'bg-violet-500/20 text-violet-100',
                  dealer.status === 'on_break' && 'bg-amber-400/20 text-amber-100',
                  dealer.status === 'available' && 'bg-emerald-500/20 text-emerald-100',
                  dealer.status === 'off_shift' && 'bg-slate-500/20 text-slate-100',
                )}
              >
                {DEALER_STATUS_LABEL[dealer.status]}
              </p>
              <p className="text-sm text-violet-100/75">
                {dealer.currentTableId
                  ? `À la table ${dealer.currentTableId} · ${GAME_TYPE_LABEL[snapshot.tables.find((item) => item.id === dealer.currentTableId)?.gameType ?? 'unassigned']}`
                  : 'Aucune table pour le moment.'}
              </p>
              <div className="grid gap-2">
                {dealer.currentTableId ? (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => select({ type: 'table', id: dealer.currentTableId! })}
                  >
                    Voir {dealer.currentTableId}
                  </button>
                ) : null}
                {dealer.status === 'assigned' && dealer.currentTableId ? (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => room.unassignDealer(dealer.currentTableId!)}
                  >
                    Retirer de la table
                  </button>
                ) : null}
                {dealer.status !== 'on_break' ? (
                  <button
                    type="button"
                    className={btnWarn}
                    onClick={() => room.setDealerStatus(dealer.id, 'on_break')}
                  >
                    Mettre en pause
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="end-break"
                    className={btnGood}
                    onClick={() => room.setDealerStatus(dealer.id, 'available')}
                  >
                    Fin de pause
                  </button>
                )}
                {dealer.status === 'off_shift' ? (
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => room.setDealerStatus(dealer.id, 'available')}
                  >
                    Remettre en salle
                  </button>
                ) : (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => room.setDealerStatus(dealer.id, 'off_shift')}
                  >
                    Hors quart
                  </button>
                )}
              </div>
              {dealer.status === 'available' ? (
                <section>
                  <h3 className="text-sm font-semibold">Tables ouvertes sans croupier</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {openGaps.length === 0 ? (
                      <p className="text-sm text-violet-100/60">Aucune table libre.</p>
                    ) : (
                      openGaps.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={btnPrimary}
                          onClick={() => room.assignDealer(item.id, dealer.id)}
                        >
                          Envoyer à {item.id}
                        </button>
                      ))
                    )}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
