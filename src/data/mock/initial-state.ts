import type {
  AvailabilitySlot,
  Dealer,
  DealerComment,
  DealerEvaluation,
  PokerTable,
  RoomSnapshot,
  Weekday,
} from '../../types/room.ts'
import { zonedTimeToUtc } from '../../utils/time.ts'

function nights(
  prefix: string,
  days: Weekday[],
  start = '17:00',
  end = '23:00',
): AvailabilitySlot[] {
  return days.map((day) => ({ id: `${prefix}-${day}`, day, start, end }))
}

function at(month: number, day: number, hour: number, minute: number): string {
  return zonedTimeToUtc(2026, month, day, hour, minute, 0).toISOString()
}

const TABLE_SEEDS: PokerTable[] = [
  {
    id: 'HN-02',
    gameType: 'tournament',
    status: 'open',
    dealerId: 'CC63',
    timelineColor: '#7C3AED',
    row: 'top',
    seat: 1,
  },
  {
    id: 'HN-04',
    gameType: 'tournament',
    status: 'open',
    dealerId: 'CC64',
    timelineColor: '#6D28D9',
    row: 'top',
    seat: 2,
  },
  {
    id: 'HN-06',
    gameType: 'tournament',
    status: 'open',
    dealerId: 'CC65',
    timelineColor: '#A855F7',
    row: 'top',
    seat: 3,
  },
  {
    id: 'HN-08',
    gameType: 'unassigned',
    status: 'closed',
    dealerId: null,
    timelineColor: '#F97316',
    row: 'top',
    seat: 4,
  },
  {
    id: 'HN-10',
    gameType: 'cash',
    status: 'open',
    dealerId: 'CC67',
    timelineColor: '#10B981',
    row: 'top',
    seat: 5,
  },
  {
    id: 'HN-12',
    gameType: 'unassigned',
    status: 'closed',
    dealerId: null,
    timelineColor: '#F43F5E',
    row: 'top',
    seat: 6,
  },
  {
    id: 'HN-03',
    gameType: 'tournament',
    status: 'open',
    dealerId: 'CC69',
    timelineColor: '#38BDF8',
    row: 'bottom',
    seat: 2,
  },
  {
    id: 'HN-05',
    gameType: 'tournament',
    status: 'open',
    dealerId: 'CC70',
    timelineColor: '#8B5CF6',
    row: 'bottom',
    seat: 3,
  },
  {
    id: 'HN-07',
    gameType: 'unassigned',
    status: 'closed',
    dealerId: null,
    timelineColor: '#FB7185',
    row: 'bottom',
    seat: 4,
  },
  {
    id: 'HN-09',
    gameType: 'unassigned',
    status: 'closed',
    dealerId: null,
    timelineColor: '#2DD4BF',
    row: 'bottom',
    seat: 5,
  },
  {
    id: 'HN-11',
    gameType: 'cash',
    status: 'open',
    dealerId: 'CC73',
    timelineColor: '#A3E635',
    row: 'bottom',
    seat: 6,
  },
]

const EMPTY = {
  availability: [] as AvailabilitySlot[],
  evaluations: [] as DealerEvaluation[],
  comments: [] as DealerComment[],
}

const DEALER_SEEDS: Dealer[] = [
  {
    id: 'CC63',
    displayName: 'CC63',
    status: 'assigned',
    currentTableId: 'HN-02',
    isAvailable: false,
    availability: nights('CC63', ['mon', 'tue', 'wed', 'thu']),
    evaluations: [
      {
        id: 'eval-cc63-1',
        at: at(11, 3, 21, 15),
        author: 'Camille Roy',
        score: 4,
        note: 'Tient le rythme sur une table tournoi pleine. Annonces claires.',
      },
    ],
    comments: [
      {
        id: 'cmt-cc63-1',
        at: at(10, 28, 18, 40),
        author: 'Camille Roy',
        text: 'A coupé la parole à un joueur qui contestait une donne. À reprendre au calme.',
        dealerAware: false,
      },
      {
        id: 'cmt-cc63-2',
        at: at(11, 12, 16, 5),
        author: 'Marc Elbaz',
        text: 'Bon réflexe sur une mise mal annoncée. Le lui dire au prochain entretien.',
        dealerAware: true,
      },
    ],
  },
  {
    id: 'CC64',
    displayName: 'CC64',
    status: 'assigned',
    currentTableId: 'HN-04',
    isAvailable: false,
    ...EMPTY,
    availability: [
      ...nights('CC64', ['fri', 'sat']),
      { id: 'CC64-sun', day: 'sun', start: '12:00', end: '20:00' },
    ],
  },
  {
    id: 'CC65',
    displayName: 'CC65',
    status: 'assigned',
    currentTableId: 'HN-06',
    isAvailable: false,
    ...EMPTY,
    availability: nights('CC65', ['mon', 'wed', 'fri']),
  },
  {
    id: 'CC66',
    displayName: 'CC66',
    status: 'available',
    currentTableId: null,
    isAvailable: true,
    availability: [
      ...nights('CC66', ['tue', 'thu']),
      { id: 'CC66-sat', day: 'sat', start: '12:00', end: '20:00' },
    ],
    evaluations: [],
    comments: [
      {
        id: 'cmt-cc66-1',
        at: at(11, 14, 23, 10),
        author: 'Camille Roy',
        text: 'Arrivé en retard deux soirs de suite. Pas encore abordé avec lui.',
        dealerAware: false,
      },
    ],
  },
  {
    id: 'CC67',
    displayName: 'CC67',
    status: 'assigned',
    currentTableId: 'HN-10',
    isAvailable: false,
    availability: nights('CC67', ['mon', 'tue', 'wed', 'thu', 'fri']),
    evaluations: [
      {
        id: 'eval-cc67-1',
        at: at(11, 8, 22, 0),
        author: 'Marc Elbaz',
        score: 3,
        note: 'Distribution correcte. À surveiller quand la table accélère.',
      },
    ],
    comments: [],
  },
  {
    id: 'CC68',
    displayName: 'CC68',
    status: 'available',
    currentTableId: null,
    isAvailable: true,
    ...EMPTY,
    availability: nights('CC68', ['sat', 'sun'], '12:00', '23:00'),
  },
  {
    id: 'CC69',
    displayName: 'CC69',
    status: 'assigned',
    currentTableId: 'HN-03',
    isAvailable: false,
    ...EMPTY,
    availability: nights('CC69', ['thu', 'fri', 'sat']),
  },
  {
    id: 'CC70',
    displayName: 'CC70',
    status: 'assigned',
    currentTableId: 'HN-05',
    isAvailable: false,
    ...EMPTY,
    availability: nights('CC70', ['mon', 'tue']),
  },
  {
    id: 'CC71',
    displayName: 'CC71',
    status: 'available',
    currentTableId: null,
    isAvailable: true,
    ...EMPTY,
    availability: nights('CC71', ['wed', 'thu', 'fri']),
  },
  {
    id: 'CC72',
    displayName: 'CC72',
    status: 'available',
    currentTableId: null,
    isAvailable: true,
    ...EMPTY,
    availability: nights('CC72', ['fri', 'sat', 'sun']),
  },
  {
    id: 'CC73',
    displayName: 'CC73',
    status: 'assigned',
    currentTableId: 'HN-11',
    isAvailable: false,
    availability: nights('CC73', ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']),
    evaluations: [
      {
        id: 'eval-cc73-1',
        at: at(11, 1, 19, 30),
        author: 'Camille Roy',
        score: 5,
        note: 'Très à l’aise au cash. Les joueurs restent calmes.',
      },
    ],
    comments: [],
  },
]

export function createInitialSnapshot(): RoomSnapshot {
  const clock = zonedTimeToUtc(2026, 11, 17, 19, 44, 0).toISOString()
  const segmentStart = zonedTimeToUtc(2026, 11, 17, 17, 0, 0).toISOString()
  const dealers = DEALER_SEEDS.map((dealer) => ({
    ...dealer,
    availability: dealer.availability.map((slot) => ({ ...slot })),
    evaluations: dealer.evaluations.map((item) => ({ ...item })),
    comments: dealer.comments.map((item) => ({ ...item })),
  }))
  return {
    version: 1,
    clock,
    settings: {
      rotationMode: 'auto',
      rotationIntervalMinutes: 30,
      noteAuthor: 'Superviseur',
    },
    tables: TABLE_SEEDS.map((table) => ({ ...table })),
    dealers,
    segments: dealers.map((dealer) => ({
      id: `initial-${dealer.id}`,
      dealerId: dealer.id,
      kind: dealer.status === 'assigned' ? 'table' : 'available',
      tableId: dealer.currentTableId,
      start: segmentStart,
      end: null,
    })),
  }
}
