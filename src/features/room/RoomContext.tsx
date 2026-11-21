import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createRoomRepository } from '../../repositories/index.ts'
import type {
  RoomSnapshot,
  RotationInterval,
  RotationMode,
  Selection,
  Weekday,
} from '../../types/room.ts'
import {
  advanceClock as advanceClockOperation,
  assignDealer as assignDealerOperation,
  closeTable as closeTableOperation,
  findAssignmentConflicts,
  openTable as openTableOperation,
  addAvailability as addAvailabilityOperation,
  addComment as addCommentOperation,
  addEvaluation as addEvaluationOperation,
  removeAvailability as removeAvailabilityOperation,
  setCommentAwareness as setCommentAwarenessOperation,
  setDealerStatus as setDealerStatusOperation,
  setGameType as setGameTypeOperation,
  setNoteAuthor as setNoteAuthorOperation,
  setRotationInterval as setRotationIntervalOperation,
  setRotationMode as setRotationModeOperation,
  setShiftTime as setShiftTimeOperation,
  unassignDealer as unassignDealerOperation,
  type OperationResult,
} from './operations.ts'

interface RoomContextValue {
  ready: boolean
  snapshot: RoomSnapshot | null
  notice: string | null
  clearNotice: () => void
  playing: boolean
  setPlaying: (playing: boolean) => void
  selection: Selection | null
  select: (selection: Selection | null) => void
  conflicts: string[]
  openTable: (tableId: string, gameType: 'tournament' | 'cash') => void
  closeTable: (tableId: string) => void
  setGameType: (tableId: string, gameType: 'tournament' | 'cash') => void
  assignDealer: (tableId: string, dealerId: string) => void
  unassignDealer: (tableId: string) => void
  setDealerStatus: (dealerId: string, status: 'available' | 'on_break' | 'off_shift') => void
  setNoteAuthor: (author: string) => void
  addAvailability: (dealerId: string, day: Weekday, start: string, end: string) => void
  removeAvailability: (dealerId: string, slotId: string) => void
  addEvaluation: (dealerId: string, input: { author: string; score: number; note: string }) => void
  addComment: (
    dealerId: string,
    input: { author: string; text: string; dealerAware: boolean },
  ) => void
  setCommentAwareness: (dealerId: string, commentId: string, dealerAware: boolean) => void
  setRotationMode: (mode: RotationMode) => void
  setRotationInterval: (minutes: RotationInterval) => void
  advanceClock: (minutes: number) => void
  setShiftTime: (hours: number, minutes: number) => void
  resetScenario: () => void
}

const Context = createContext<RoomContextValue | null>(null)

export function RoomProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => createRoomRepository(), [])
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const snapshotRef = useRef<RoomSnapshot | null>(null)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    let active = true
    void repository.load().then(
      (loaded) => {
        if (!active) return
        snapshotRef.current = loaded
        setSnapshot(loaded)
        setHydrated(true)
      },
      (error: unknown) => {
        if (!active) return
        setNotice(error instanceof Error ? error.message : 'Impossible de charger la salle.')
        setHydrated(true)
      },
    )
    return () => {
      active = false
    }
  }, [repository])

  useEffect(() => {
    if (!hydrated || !snapshot) return
    void repository.save(snapshot)
  }, [hydrated, repository, snapshot])

  const apply = useCallback((operation: (current: RoomSnapshot) => OperationResult) => {
    const current = snapshotRef.current
    if (!current) return
    const result = operation(current)
    snapshotRef.current = result.snapshot
    setNotice(result.error)
    setSnapshot(result.snapshot)
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const current = snapshotRef.current
      if (!current) return
      const result = advanceClockOperation(current, 1)
      if (result.error) {
        setPlaying(false)
        setNotice(result.error)
        return
      }
      snapshotRef.current = result.snapshot
      setSnapshot(result.snapshot)
    }, 700)
    return () => window.clearInterval(id)
  }, [playing])

  const resetScenario = useCallback(() => {
    setPlaying(false)
    setSelection(null)
    setNotice(null)
    void repository.reset().then((fresh) => {
      snapshotRef.current = fresh
      setSnapshot(fresh)
    })
  }, [repository])

  const conflicts = useMemo(() => (snapshot ? findAssignmentConflicts(snapshot) : []), [snapshot])

  const value = useMemo<RoomContextValue>(
    () => ({
      ready: hydrated,
      snapshot,
      notice,
      clearNotice: () => setNotice(null),
      playing,
      setPlaying,
      selection,
      select: setSelection,
      conflicts,
      openTable: (tableId, gameType) =>
        apply((current) => openTableOperation(current, tableId, gameType)),
      closeTable: (tableId) => apply((current) => closeTableOperation(current, tableId)),
      setGameType: (tableId, gameType) =>
        apply((current) => setGameTypeOperation(current, tableId, gameType)),
      assignDealer: (tableId, dealerId) =>
        apply((current) => assignDealerOperation(current, tableId, dealerId)),
      unassignDealer: (tableId) => apply((current) => unassignDealerOperation(current, tableId)),
      setDealerStatus: (dealerId, status) =>
        apply((current) => setDealerStatusOperation(current, dealerId, status)),
      setNoteAuthor: (author) => apply((current) => setNoteAuthorOperation(current, author)),
      addAvailability: (dealerId, day, start, end) =>
        apply((current) => addAvailabilityOperation(current, dealerId, day, start, end)),
      removeAvailability: (dealerId, slotId) =>
        apply((current) => removeAvailabilityOperation(current, dealerId, slotId)),
      addEvaluation: (dealerId, input) =>
        apply((current) => addEvaluationOperation(current, dealerId, input)),
      addComment: (dealerId, input) =>
        apply((current) => addCommentOperation(current, dealerId, input)),
      setCommentAwareness: (dealerId, commentId, dealerAware) =>
        apply((current) => setCommentAwarenessOperation(current, dealerId, commentId, dealerAware)),
      setRotationMode: (mode) => apply((current) => setRotationModeOperation(current, mode)),
      setRotationInterval: (minutes) =>
        apply((current) => setRotationIntervalOperation(current, minutes)),
      advanceClock: (minutes) => apply((current) => advanceClockOperation(current, minutes)),
      setShiftTime: (hours, minutes) =>
        apply((current) => setShiftTimeOperation(current, hours, minutes)),
      resetScenario,
    }),
    [apply, conflicts, hydrated, notice, playing, resetScenario, selection, snapshot],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useRoom(): RoomContextValue {
  const value = useContext(Context)
  if (!value) throw new Error('useRoom doit être utilisé dans RoomProvider.')
  return value
}
