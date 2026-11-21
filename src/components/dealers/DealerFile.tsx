import { useState } from 'react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import type { Weekday } from '../../types/room.ts'
import { btnPrimary, cx } from '../../utils/cx.ts'
import { WEEKDAY_LABEL, WEEKDAYS } from '../../utils/labels.ts'
import { formatNoteStamp } from '../../utils/time.ts'

export function DealerFile({ dealerId, onBack }: { dealerId: string; onBack: () => void }) {
  const room = useRoom()
  const dealer = room.snapshot?.dealers.find((item) => item.id === dealerId)
  const authorDefault = room.snapshot?.settings.noteAuthor ?? 'Superviseur'
  const [day, setDay] = useState<Weekday>('mon')
  const [start, setStart] = useState('17:00')
  const [end, setEnd] = useState('23:00')
  const [score, setScore] = useState(3)
  const [note, setNote] = useState('')
  const [evalAuthor, setEvalAuthor] = useState(authorDefault)
  const [comment, setComment] = useState('')
  const [commentAuthor, setCommentAuthor] = useState(authorDefault)
  const [dealerAware, setDealerAware] = useState(false)

  if (!dealer || !room.snapshot) return null

  const rememberAuthor = (name: string) => {
    if (name.trim() && name.trim() !== room.snapshot?.settings.noteAuthor) room.setNoteAuthor(name)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="dealer-file">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <button
            type="button"
            className="mb-1 text-xs text-violet-200/70 lg:hidden"
            onClick={onBack}
          >
            Retour à la liste
          </button>
          <h2 className="font-display text-2xl font-semibold">{dealer.displayName}</h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto overscroll-contain px-4 py-4">
        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h3 className="font-display text-lg font-semibold">Disponibilités</h3>
          <p className="mt-1 text-sm text-violet-100/70">
            Heures où ce croupier peut être mis à l’horaire.
          </p>
          {dealer.availability.length === 0 ? (
            <p className="mt-3 text-sm text-violet-100/50">Aucune plage notée.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dealer.availability.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {WEEKDAY_LABEL[slot.day]} · {slot.start}–{slot.end}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-rose-200 underline"
                    onClick={() => room.removeAvailability(dealer.id, slot.id)}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              room.addAvailability(dealer.id, day, start, end)
            }}
          >
            <label className="text-xs text-violet-100/60">
              Jour
              <select
                value={day}
                onChange={(event) => setDay(event.target.value as Weekday)}
                className="mt-1 block rounded-lg border border-white/10 bg-[#0e0b1c] px-2 py-2 text-sm text-white"
              >
                {WEEKDAYS.map((item) => (
                  <option key={item} value={item}>
                    {WEEKDAY_LABEL[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-violet-100/60">
              Début
              <input
                value={start}
                onChange={(event) => setStart(event.target.value)}
                pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                required
                className="mt-1 block w-24 rounded-lg border border-white/10 bg-[#0e0b1c] px-2 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-violet-100/60">
              Fin
              <input
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
                required
                className="mt-1 block w-24 rounded-lg border border-white/10 bg-[#0e0b1c] px-2 py-2 text-sm"
              />
            </label>
            <button type="submit" className={btnPrimary}>
              Ajouter
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h3 className="font-display text-lg font-semibold">Évaluations</h3>
          <p className="mt-1 text-sm text-violet-100/70">Note de 1 à 5 et une observation.</p>
          {dealer.evaluations.length === 0 ? (
            <p className="mt-3 text-sm text-violet-100/50">Aucune évaluation.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {dealer.evaluations.map((item) => (
                <li key={item.id} className="rounded-xl bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold">
                    {item.score}/5 · {item.author}
                  </p>
                  <p className="text-xs text-violet-100/50">{formatNoteStamp(item.at)}</p>
                  <p className="mt-1 text-sm text-violet-50">{item.note}</p>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              room.addEvaluation(dealer.id, { author: evalAuthor, score, note })
              rememberAuthor(evalAuthor)
              setNote('')
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-violet-100/60">Note</span>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={score === value}
                  className={cx(
                    'h-8 w-8 rounded-lg text-sm font-semibold',
                    score === value ? 'bg-violet-600 text-white' : 'bg-white/10 text-violet-100',
                  )}
                  onClick={() => setScore(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <input
              value={evalAuthor}
              onChange={(event) => setEvalAuthor(event.target.value)}
              aria-label="Auteur de l’évaluation"
              placeholder="Qui évalue"
              className="w-full rounded-lg border border-white/10 bg-[#0e0b1c] px-3 py-2 text-sm"
            />
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder="Observation"
              className="w-full rounded-lg border border-white/10 bg-[#0e0b1c] px-3 py-2 text-sm"
            />
            <button type="submit" className={btnPrimary}>
              Enregistrer l’évaluation
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#141226] p-4">
          <h3 className="font-display text-lg font-semibold">Commentaires</h3>
          <p className="mt-1 text-sm text-violet-100/70">
            Chaque note garde sa date, son auteur, et si le croupier en a été informé. Cochez « au
            courant » une fois que la personne l’a entendu, pour le reprendre plus tard.
          </p>
          {dealer.comments.length === 0 ? (
            <p className="mt-3 text-sm text-violet-100/50">Aucun commentaire.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {dealer.comments.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl bg-white/5 px-3 py-2"
                  data-testid="dealer-comment"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{item.author}</p>
                      <p className="text-xs text-violet-100/50">{formatNoteStamp(item.at)}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={item.dealerAware}
                      className={cx(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        item.dealerAware
                          ? 'bg-emerald-500/20 text-emerald-100'
                          : 'bg-amber-400/15 text-amber-100',
                      )}
                      onClick={() =>
                        room.setCommentAwareness(dealer.id, item.id, !item.dealerAware)
                      }
                    >
                      {item.dealerAware ? 'Au courant' : 'Pas encore au courant'}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-violet-50">{item.text}</p>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              room.addComment(dealer.id, {
                author: commentAuthor,
                text: comment,
                dealerAware,
              })
              rememberAuthor(commentAuthor)
              setComment('')
              setDealerAware(false)
            }}
          >
            <input
              value={commentAuthor}
              onChange={(event) => setCommentAuthor(event.target.value)}
              aria-label="Auteur du commentaire"
              placeholder="Qui écrit"
              className="w-full rounded-lg border border-white/10 bg-[#0e0b1c] px-3 py-2 text-sm"
            />
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="Commentaire"
              className="w-full rounded-lg border border-white/10 bg-[#0e0b1c] px-3 py-2 text-sm"
            />
            <label className="flex items-start gap-2 text-sm text-violet-100/80">
              <input
                type="checkbox"
                checked={dealerAware}
                onChange={(event) => setDealerAware(event.target.checked)}
                className="mt-1"
              />
              Le croupier est au courant de ce commentaire.
            </label>
            <button type="submit" className={btnPrimary}>
              Ajouter le commentaire
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
