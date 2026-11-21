import type { PokerTable, RoomSnapshot, RoomSummary } from '../../types/room.ts'

export function isRoomOpen(tables: PokerTable[]): boolean {
  return tables.some((table) => table.status === 'open')
}

export function summarize(snapshot: RoomSnapshot): RoomSummary {
  const { tables, dealers } = snapshot
  return {
    tournamentTables: tables.filter(
      (table) => table.status === 'open' && table.gameType === 'tournament',
    ).length,
    cashTables: tables.filter((table) => table.status === 'open' && table.gameType === 'cash')
      .length,
    closedTables: tables.filter((table) => table.status === 'closed').length,
    openWithoutDealer: tables.filter((table) => table.status === 'open' && !table.dealerId).length,
    dealersInRoom: dealers.filter((dealer) => dealer.status !== 'off_shift').length,
    dealersAssigned: dealers.filter((dealer) => dealer.status === 'assigned').length,
    dealersOnBreak: dealers.filter((dealer) => dealer.status === 'on_break').length,
    dealersAvailable: dealers.filter((dealer) => dealer.status === 'available').length,
    dealersOffShift: dealers.filter((dealer) => dealer.status === 'off_shift').length,
  }
}
