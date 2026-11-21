import type {
  ActivityKind,
  ActivitySegment,
  Dealer,
  DealerStatus,
  PokerTable,
  RoomSnapshot,
  RotationInterval,
  RotationMode,
  Weekday,
} from '../../types/room.ts'
import {
  addMinutes,
  isWithinShift,
  shiftEnd,
  zonedParts,
  zonedTimeToUtc,
} from '../../utils/time.ts'

export interface OperationResult {
  snapshot: RoomSnapshot
  error: string | null
}

let sequence = 0

export function resetOperationIds(): void {
  sequence = 0
}

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

function nextSegmentId(): string {
  return nextId('seg')
}

function ok(snapshot: RoomSnapshot): OperationResult {
  return { snapshot, error: null }
}

function fail(snapshot: RoomSnapshot, error: string): OperationResult {
  return { snapshot, error }
}

function tableById(snapshot: RoomSnapshot, tableId: string): PokerTable | undefined {
  return snapshot.tables.find((table) => table.id === tableId)
}

function dealerById(snapshot: RoomSnapshot, dealerId: string): Dealer | undefined {
  return snapshot.dealers.find((dealer) => dealer.id === dealerId)
}

function updateTable(
  snapshot: RoomSnapshot,
  tableId: string,
  patch: Partial<PokerTable>,
): RoomSnapshot {
  return {
    ...snapshot,
    tables: snapshot.tables.map((table) => (table.id === tableId ? { ...table, ...patch } : table)),
  }
}

function updateDealer(
  snapshot: RoomSnapshot,
  dealerId: string,
  patch: Partial<Dealer>,
): RoomSnapshot {
  return {
    ...snapshot,
    dealers: snapshot.dealers.map((dealer) =>
      dealer.id === dealerId ? { ...dealer, ...patch } : dealer,
    ),
  }
}

function kindFor(status: DealerStatus, tableId: string | null): ActivityKind {
  if (status === 'assigned' && tableId) return 'table'
  if (status === 'on_break') return 'break'
  if (status === 'off_shift') return 'off_shift'
  return 'available'
}

function transitionDealer(
  snapshot: RoomSnapshot,
  dealerId: string,
  status: DealerStatus,
  tableId: string | null,
): RoomSnapshot {
  const at = snapshot.clock
  const kind = kindFor(status, tableId)
  const open = snapshot.segments.find(
    (segment) => segment.dealerId === dealerId && segment.end === null,
  )
  const dealerPatch: Partial<Dealer> = {
    status,
    currentTableId: tableId,
    isAvailable: status === 'available',
  }

  if (open && open.kind === kind && open.tableId === tableId) {
    return updateDealer(snapshot, dealerId, dealerPatch)
  }

  let segments: ActivitySegment[]
  if (open && new Date(open.start).getTime() >= new Date(at).getTime()) {
    segments = snapshot.segments.map((segment) =>
      segment.id === open.id ? { ...segment, kind, tableId } : segment,
    )
  } else {
    segments = snapshot.segments.map((segment) =>
      segment.dealerId === dealerId && segment.end === null ? { ...segment, end: at } : segment,
    )
    segments = [
      ...segments,
      {
        id: nextSegmentId(),
        dealerId,
        kind,
        tableId,
        start: at,
        end: null,
      },
    ]
  }

  return { ...updateDealer(snapshot, dealerId, dealerPatch), segments }
}

function releaseDealer(
  snapshot: RoomSnapshot,
  dealerId: string,
  status: 'available' | 'on_break' | 'off_shift',
): RoomSnapshot {
  const dealer = dealerById(snapshot, dealerId)
  if (!dealer) return snapshot
  let next = snapshot
  if (dealer.currentTableId) {
    next = updateTable(next, dealer.currentTableId, { dealerId: null })
  }
  return transitionDealer(next, dealerId, status, null)
}

export function openTable(
  snapshot: RoomSnapshot,
  tableId: string,
  gameType: 'tournament' | 'cash',
): OperationResult {
  const table = tableById(snapshot, tableId)
  if (!table) return fail(snapshot, 'Table introuvable.')
  if (table.status === 'open' && table.gameType === gameType) return ok(snapshot)
  return ok(updateTable(snapshot, tableId, { status: 'open', gameType }))
}

export function closeTable(snapshot: RoomSnapshot, tableId: string): OperationResult {
  const table = tableById(snapshot, tableId)
  if (!table) return fail(snapshot, 'Table introuvable.')
  if (table.status === 'closed') return ok(snapshot)
  let next = snapshot
  if (table.dealerId) next = releaseDealer(next, table.dealerId, 'available')
  return ok(
    updateTable(next, tableId, {
      status: 'closed',
      gameType: 'unassigned',
      dealerId: null,
    }),
  )
}

export function setGameType(
  snapshot: RoomSnapshot,
  tableId: string,
  gameType: 'tournament' | 'cash',
): OperationResult {
  const table = tableById(snapshot, tableId)
  if (!table) return fail(snapshot, 'Table introuvable.')
  if (table.status !== 'open') {
    return fail(snapshot, 'Ouvrez la table avant de changer le type de jeu.')
  }
  return ok(updateTable(snapshot, tableId, { gameType }))
}

export function assignDealer(
  snapshot: RoomSnapshot,
  tableId: string,
  dealerId: string,
): OperationResult {
  const table = tableById(snapshot, tableId)
  const dealer = dealerById(snapshot, dealerId)
  if (!table) return fail(snapshot, 'Table introuvable.')
  if (!dealer) return fail(snapshot, 'Croupier introuvable.')
  if (table.status !== 'open') {
    return fail(snapshot, `Ouvrez ${table.id} avant d'y affecter un croupier.`)
  }
  if (table.dealerId === dealerId) return ok(snapshot)
  if (table.dealerId) {
    return fail(
      snapshot,
      `${table.dealerId} est déjà à ${table.id}. Retirez-le avant une nouvelle affectation.`,
    )
  }
  if (dealer.status === 'on_break') return fail(snapshot, `${dealer.displayName} est en pause.`)
  if (dealer.status === 'off_shift') return fail(snapshot, `${dealer.displayName} est hors quart.`)
  if (dealer.status === 'assigned' || dealer.currentTableId) {
    return fail(
      snapshot,
      `${dealer.displayName} est déjà à ${dealer.currentTableId ?? 'une table'}. Retirez-le d'abord.`,
    )
  }
  const withTable = updateTable(snapshot, tableId, { dealerId })
  return ok(transitionDealer(withTable, dealerId, 'assigned', tableId))
}

export function unassignDealer(snapshot: RoomSnapshot, tableId: string): OperationResult {
  const table = tableById(snapshot, tableId)
  if (!table) return fail(snapshot, 'Table introuvable.')
  if (!table.dealerId) return fail(snapshot, 'Aucun croupier sur cette table.')
  return ok(releaseDealer(snapshot, table.dealerId, 'available'))
}

export function setDealerStatus(
  snapshot: RoomSnapshot,
  dealerId: string,
  status: 'available' | 'on_break' | 'off_shift',
): OperationResult {
  const dealer = dealerById(snapshot, dealerId)
  if (!dealer) return fail(snapshot, 'Croupier introuvable.')
  if (status === 'available' && dealer.status === 'assigned') {
    return fail(snapshot, 'Retirez le croupier de sa table pour le rendre disponible.')
  }
  if (dealer.status === status && !dealer.currentTableId) return ok(snapshot)
  return ok(releaseDealer(snapshot, dealerId, status))
}

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const WEEKDAY_SET = new Set<Weekday>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

function clockMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function cleanName(value: string): string | null {
  const name = value.trim()
  if (!name || name.length > 80) return null
  return name
}

export function setNoteAuthor(snapshot: RoomSnapshot, author: string): OperationResult {
  const name = cleanName(author)
  if (!name) return fail(snapshot, 'Indiquez qui signe les notes.')
  if (snapshot.settings.noteAuthor === name) return ok(snapshot)
  return ok({ ...snapshot, settings: { ...snapshot.settings, noteAuthor: name } })
}

export function addAvailability(
  snapshot: RoomSnapshot,
  dealerId: string,
  day: Weekday,
  start: string,
  end: string,
): OperationResult {
  const dealer = dealerById(snapshot, dealerId)
  if (!dealer) return fail(snapshot, 'Croupier introuvable.')
  if (!WEEKDAY_SET.has(day) || !CLOCK_TIME.test(start) || !CLOCK_TIME.test(end)) {
    return fail(snapshot, 'Indiquez un jour et des heures valides.')
  }
  if (clockMinutes(end) <= clockMinutes(start)) {
    return fail(snapshot, 'La fin du créneau doit être après le début.')
  }
  const overlaps = dealer.availability.some(
    (slot) =>
      slot.day === day &&
      clockMinutes(start) < clockMinutes(slot.end) &&
      clockMinutes(end) > clockMinutes(slot.start),
  )
  if (overlaps) return fail(snapshot, 'Ce créneau chevauche une disponibilité déjà notée.')
  const slot = { id: nextId('avail'), day, start, end }
  return ok(updateDealer(snapshot, dealerId, { availability: [...dealer.availability, slot] }))
}

export function removeAvailability(
  snapshot: RoomSnapshot,
  dealerId: string,
  slotId: string,
): OperationResult {
  const dealer = dealerById(snapshot, dealerId)
  if (!dealer) return fail(snapshot, 'Croupier introuvable.')
  if (!dealer.availability.some((slot) => slot.id === slotId)) {
    return fail(snapshot, 'Créneau introuvable.')
  }
  return ok(
    updateDealer(snapshot, dealerId, {
      availability: dealer.availability.filter((slot) => slot.id !== slotId),
    }),
  )
}

export function addEvaluation(
  snapshot: RoomSnapshot,
  dealerId: string,
  input: { author: string; score: number; note: string; at?: string },
): OperationResult {
  const dealer = dealerById(snapshot, dealerId)
  if (!dealer) return fail(snapshot, 'Croupier introuvable.')
  const author = cleanName(input.author)
  const note = input.note.trim()
  if (!author) return fail(snapshot, 'Indiquez qui signe l’évaluation.')
  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    return fail(snapshot, 'La note va de 1 à 5.')
  }
  if (!note || note.length > 500) return fail(snapshot, 'Ajoutez une observation.')
  const evaluation = {
    id: nextId('eval'),
    at: input.at ?? new Date().toISOString(),
    author,
    score: input.score,
    note,
  }
  return ok(updateDealer(snapshot, dealerId, { evaluations: [evaluation, ...dealer.evaluations] }))
}

export function addComment(
  snapshot: RoomSnapshot,
  dealerId: string,
  input: { author: string; text: string; dealerAware: boolean; at?: string },
): OperationResult {
  const dealer = dealerById(snapshot, dealerId)
  if (!dealer) return fail(snapshot, 'Croupier introuvable.')
  const author = cleanName(input.author)
  const text = input.text.trim()
  if (!author) return fail(snapshot, 'Indiquez qui écrit le commentaire.')
  if (!text || text.length > 1000) return fail(snapshot, 'Écrivez le commentaire.')
  const comment = {
    id: nextId('cmt'),
    at: input.at ?? new Date().toISOString(),
    author,
    text,
    dealerAware: input.dealerAware,
  }
  return ok(updateDealer(snapshot, dealerId, { comments: [comment, ...dealer.comments] }))
}

export function setCommentAwareness(
  snapshot: RoomSnapshot,
  dealerId: string,
  commentId: string,
  dealerAware: boolean,
): OperationResult {
  const dealer = dealerById(snapshot, dealerId)
  if (!dealer) return fail(snapshot, 'Croupier introuvable.')
  if (!dealer.comments.some((comment) => comment.id === commentId)) {
    return fail(snapshot, 'Commentaire introuvable.')
  }
  return ok(
    updateDealer(snapshot, dealerId, {
      comments: dealer.comments.map((comment) =>
        comment.id === commentId ? { ...comment, dealerAware } : comment,
      ),
    }),
  )
}

export function setRotationMode(
  snapshot: RoomSnapshot,
  rotationMode: RotationMode,
): OperationResult {
  if (snapshot.settings.rotationMode === rotationMode) return ok(snapshot)
  return ok({ ...snapshot, settings: { ...snapshot.settings, rotationMode } })
}

export function setRotationInterval(
  snapshot: RoomSnapshot,
  rotationIntervalMinutes: RotationInterval,
): OperationResult {
  if (snapshot.settings.rotationIntervalMinutes === rotationIntervalMinutes) return ok(snapshot)
  return ok({ ...snapshot, settings: { ...snapshot.settings, rotationIntervalMinutes } })
}

export function setShiftTime(
  snapshot: RoomSnapshot,
  hours: number,
  minutes: number,
): OperationResult {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return fail(snapshot, 'Heure invalide.')
  }
  const parts = zonedParts(new Date(snapshot.clock))
  const date = zonedTimeToUtc(parts.year, parts.month, parts.day, hours, minutes, 0)
  return setClock(snapshot, date.toISOString())
}

export function advanceClock(snapshot: RoomSnapshot, minutes: number): OperationResult {
  if (!Number.isFinite(minutes) || minutes === 0) return ok(snapshot)
  if (minutes < 0) {
    return fail(snapshot, 'Pour revenir en arrière, réinitialisez le scénario.')
  }
  const target = new Date(addMinutes(snapshot.clock, minutes))
  const end = shiftEnd(snapshot.clock)
  if (target.getTime() > end.getTime()) {
    if (new Date(snapshot.clock).getTime() >= end.getTime()) {
      return fail(snapshot, 'Fin du quart affichée (23:00). Réinitialisez pour recommencer.')
    }
    return ok({ ...snapshot, clock: end.toISOString() })
  }
  return setClock(snapshot, target.toISOString())
}

export function setClock(snapshot: RoomSnapshot, iso: string): OperationResult {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return fail(snapshot, 'Heure invalide.')
  if (!isWithinShift(date, snapshot.clock)) {
    return fail(snapshot, "L'horloge du prototype reste dans le quart 17:00 – 23:00.")
  }
  return ok({ ...snapshot, clock: date.toISOString() })
}

export function findAssignmentConflicts(snapshot: RoomSnapshot): string[] {
  const conflicts: string[] = []
  const owner = new Map<string, string>()

  for (const table of snapshot.tables) {
    if (table.status === 'closed' && table.dealerId) {
      conflicts.push(`${table.id} est fermée mais indique ${table.dealerId}.`)
    }
    if (table.status === 'closed' && table.gameType !== 'unassigned') {
      conflicts.push(`${table.id} est fermée mais garde un type de jeu.`)
    }
    if (!table.dealerId) continue
    const previous = owner.get(table.dealerId)
    if (previous) conflicts.push(`${table.dealerId} est indiqué sur ${previous} et ${table.id}.`)
    owner.set(table.dealerId, table.id)
    const dealer = dealerById(snapshot, table.dealerId)
    if (!dealer) {
      conflicts.push(`${table.id} indique un croupier inconnu (${table.dealerId}).`)
      continue
    }
    if (dealer.currentTableId !== table.id || dealer.status !== 'assigned') {
      conflicts.push(`${dealer.id} sur ${table.id} n'a pas le statut affecté attendu.`)
    }
  }

  for (const dealer of snapshot.dealers) {
    if (dealer.isAvailable !== (dealer.status === 'available')) {
      conflicts.push(`${dealer.id} a un indicateur de disponibilité incohérent.`)
    }
    if (dealer.status === 'assigned') {
      const table = snapshot.tables.find((item) => item.dealerId === dealer.id)
      if (!table) conflicts.push(`${dealer.id} est affecté sans table.`)
    } else if (dealer.currentTableId) {
      conflicts.push(`${dealer.id} est ${dealer.status} mais reste lié à ${dealer.currentTableId}.`)
    }
  }

  const openCount = new Map<string, number>()
  for (const segment of snapshot.segments) {
    if (segment.end !== null) continue
    openCount.set(segment.dealerId, (openCount.get(segment.dealerId) ?? 0) + 1)
  }
  for (const dealer of snapshot.dealers) {
    if ((openCount.get(dealer.id) ?? 0) !== 1) {
      conflicts.push(`${dealer.id} devrait avoir une seule période en cours.`)
    }
  }

  return conflicts
}
