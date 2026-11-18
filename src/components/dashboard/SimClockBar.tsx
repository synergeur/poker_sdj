import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRoom } from '../../features/room/RoomContext.tsx'
import { btnGhost } from '../../utils/cx.ts'
import { formatTime } from '../../utils/time.ts'

export function SimClockBar() {
  const { snapshot, playing, setPlaying, advanceClock, setShiftTime, resetScenario } = useRoom()
  const [armed, setArmed] = useState(false)
  const [timeDraft, setTimeDraft] = useState<string | null>(null)

  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(id)
  }, [armed])

  if (!snapshot) return null

  return (
    <section
      title="L'horloge déplace le repère 17:00 – 23:00. Elle ne lance aucune rotation."
      className="flex shrink-0 items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#141226] px-3 py-1.5"
    >
      <p className="mr-auto shrink-0 text-[11px] tracking-[0.14em] text-violet-200/55 uppercase">
        Horloge simulée
      </p>
      <button
        type="button"
        data-testid="clock-play"
        className={btnGhost}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? <Pause size={15} /> : <Play size={15} />}
        {playing ? 'Pause' : 'Avancer'}
      </button>
      <button
        type="button"
        data-testid="clock-plus-15"
        className={btnGhost}
        onClick={() => advanceClock(15)}
      >
        +15 min
      </button>
      <button
        type="button"
        data-testid="clock-plus-30"
        className={btnGhost}
        onClick={() => advanceClock(30)}
      >
        +30 min
      </button>
      <label className="flex items-center gap-2 text-sm text-violet-100/80" htmlFor="shift-time">
        Heure
        <input
          id="shift-time"
          name="shift-time"
          type="text"
          inputMode="numeric"
          spellCheck={false}
          autoComplete="off"
          data-testid="clock-input"
          aria-label="Heure simulée, format 24 heures"
          value={timeDraft ?? formatTime(snapshot.clock)}
          onChange={(event) => {
            const next = event.target.value
            setTimeDraft(next)
            const match = /^(\d{2}):(\d{2})$/.exec(next)
            if (!match) return
            setShiftTime(Number(match[1]), Number(match[2]))
          }}
          onBlur={() => setTimeDraft(null)}
          className="w-[4.5rem] rounded-lg border border-white/10 bg-[#090712] px-2 py-1.5 tabular-nums"
        />
      </label>
      <button
        type="button"
        data-testid="clock-reset"
        className={btnGhost}
        onClick={() => {
          if (!armed) {
            setArmed(true)
            return
          }
          setArmed(false)
          resetScenario()
        }}
      >
        <RotateCcw size={15} />
        {armed ? 'Confirmer' : 'Réinitialiser'}
      </button>
    </section>
  )
}
