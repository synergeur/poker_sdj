export const SCHEDULE_ORIGIN_MINUTES = 10 * 60;
export const SCHEDULE_SPAN_MINUTES = 18 * 60;

const DAY_MINUTES = 24 * 60;
const NEXT_DAY_OFFSET = DAY_MINUTES - SCHEDULE_ORIGIN_MINUTES;

export type AvailabilityTone = "available" | "off" | "exception";

export type AvailabilityBand = {
  start: number;
  end: number;
  tone: AvailabilityTone;
};

export type ScheduleWindow = {
  weekday: number;
  available: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type ScheduleException = {
  workDate: string;
  available: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export type ScheduleAvailability = {
  weekdays: ScheduleWindow[];
  exceptions: ScheduleException[];
};

export type ScheduleEmployee = ScheduleAvailability & {
  userId: string;
  name: string;
  role: string | null;
  cashier: boolean;
};

export function formatScheduleMinutes(offset: number) {
  const clock = (SCHEDULE_ORIGIN_MINUTES + offset) % DAY_MINUTES;
  const hours = Math.floor(clock / 60);
  const minutes = clock % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function availabilityBands(person: ScheduleAvailability, date: string): AvailabilityBand[] {
  const next = shiftDate(date, 1);
  const cuts = new Set<number>([0, SCHEDULE_SPAN_MINUTES]);
  for (const cut of dayCuts(person, date)) {
    if (cut >= SCHEDULE_ORIGIN_MINUTES && cut <= DAY_MINUTES) cuts.add(cut - SCHEDULE_ORIGIN_MINUTES);
  }
  for (const cut of dayCuts(person, next)) {
    if (cut >= 0 && cut <= SCHEDULE_SPAN_MINUTES - NEXT_DAY_OFFSET) cuts.add(NEXT_DAY_OFFSET + cut);
  }

  const points = [...cuts].sort((left, right) => left - right);
  const bands: AvailabilityBand[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index] ?? 0;
    const end = points[index + 1] ?? start;
    if (end <= start) continue;
    const mid = (start + end) / 2;
    const onNextDay = mid >= NEXT_DAY_OFFSET;
    const minute = onNextDay ? mid - NEXT_DAY_OFFSET : SCHEDULE_ORIGIN_MINUTES + mid;
    const tone = toneAt(person, onNextDay ? next : date, minute);
    const previous = bands[bands.length - 1];
    if (previous && previous.tone === tone && previous.end === start) previous.end = end;
    else bands.push({ start, end, tone });
  }
  return bands;
}

function dayCuts(person: ScheduleAvailability, date: string) {
  const cuts = [0, DAY_MINUTES];
  const exception = person.exceptions.find((item) => item.workDate === date);
  const window = exception ?? person.weekdays.find((item) => item.weekday === weekday(date));
  if (window?.available) {
    const start = clockMinutes(window.startsAt);
    const end = clockMinutes(window.endsAt);
    if (start !== null) cuts.push(start);
    if (end !== null) cuts.push(end);
  }
  return cuts;
}

function toneAt(person: ScheduleAvailability, date: string, minute: number): AvailabilityTone {
  const exception = person.exceptions.find((item) => item.workDate === date);
  if (exception) {
    if (!exception.available) return "exception";
    return covers(minute, exception.startsAt, exception.endsAt) ? "available" : "off";
  }
  const day = person.weekdays.find((item) => item.weekday === weekday(date));
  if (day?.available && covers(minute, day.startsAt, day.endsAt)) return "available";
  return "off";
}

function covers(minute: number, startsAt: string | null, endsAt: string | null) {
  const start = clockMinutes(startsAt);
  const end = clockMinutes(endsAt);
  if (start === null || end === null || end <= start) return false;
  return minute >= start && minute < end;
}

function clockMinutes(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

function weekday(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const index = date.getUTCDay();
  return index === 0 ? 7 : index;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}
