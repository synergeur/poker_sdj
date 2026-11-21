import type { DealerStatus, GameType, PokerTable, RotationMode, Weekday } from '../types/room.ts'

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mer',
  thu: 'Jeu',
  fri: 'Ven',
  sat: 'Sam',
  sun: 'Dim',
}

export const GAME_TYPE_LABEL: Record<GameType, string> = {
  tournament: 'Tournois',
  cash: 'Cash Game',
  unassigned: 'Non assigné',
}

export const DEALER_STATUS_LABEL: Record<DealerStatus, string> = {
  assigned: 'Affecté',
  on_break: 'En pause',
  available: 'Disponible',
  off_shift: 'Hors quart',
}

export const ROTATION_MODE_LABEL: Record<RotationMode, string> = {
  auto: 'Auto',
  manual: 'Manuel',
}

export function categoryColor(table: Pick<PokerTable, 'status' | 'gameType' | 'dealerId'>): string {
  if (table.status === 'closed') return '#6b7280'
  if (!table.dealerId) return '#f59e0b'
  if (table.gameType === 'cash') return '#22c55e'
  return '#a855f7'
}

export function tableStatusLabel(
  table: Pick<PokerTable, 'status' | 'gameType' | 'dealerId'>,
): string {
  if (table.status === 'closed') return 'Fermée'
  if (!table.dealerId) return 'Ouverte, sans croupier'
  return `Ouverte · ${GAME_TYPE_LABEL[table.gameType]}`
}

export const PROTOTYPE_RULES = [
  'Fermer une table retire le croupier et le rend disponible. Le type de jeu redevient non assigné.',
  'Ouvrir une table demande un choix : Tournois ou Cash Game. Personne n’est appelé automatiquement.',
  'Un croupier ne peut occuper qu’une seule table. Une seconde affectation est refusée.',
  'La pause et la fin de quart retirent le croupier. La table reste ouverte et affiche « Sans croupier ».',
  'Changer Tournois / Cash Game garde le croupier en place.',
  'La salle est ouverte dès qu’une table l’est, et fermée seulement quand toutes les tables sont fermées.',
  'L’horloge simulée déplace le repère de temps. Elle ne déplace aucun croupier.',
  'Les barres après l’heure actuelle prolongent l’affectation en cours. Ce n’est pas une rotation calculée.',
  'Le mode et l’intervalle sont mémorisés. Aucun cycle, aucun chip run, aucun déplacement automatique.',
]
