import { TZDate } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, endOfMonth, startOfMonth } from 'date-fns';

import type { BreakSession, RoundingRule, SessionWithBreaks, WorkSession } from './models';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

export function grossDurationMs(session: WorkSession, nowUtc = Date.now()): number {
  return Math.max(0, (session.endedAtUtc ?? nowUtc) - session.startedAtUtc);
}

export function unpaidBreakDurationMs(breaks: BreakSession[], nowUtc = Date.now()): number {
  return breaks
    .filter((item) => !item.isPaid && !item.deletedAtUtc)
    .reduce(
      (total, item) => total + Math.max(0, (item.endedAtUtc ?? nowUtc) - item.startedAtUtc),
      0,
    );
}

export function netDurationMs(value: SessionWithBreaks, nowUtc = Date.now()): number {
  return Math.max(
    0,
    grossDurationMs(value.session, nowUtc) - unpaidBreakDurationMs(value.breaks, nowUtc),
  );
}

export function roundMinutes(minutes: number, rule?: RoundingRule): number {
  if (!rule) return minutes;
  const ratio = minutes / rule.incrementMinutes;
  const rounded =
    rule.mode === 'UP'
      ? Math.ceil(ratio)
      : rule.mode === 'DOWN'
        ? Math.floor(ratio)
        : Math.round(ratio);
  return rounded * rule.incrementMinutes;
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number | undefined,
  bStart: number,
  bEnd: number | undefined,
): boolean {
  const normalizedAEnd = aEnd ?? Number.POSITIVE_INFINITY;
  const normalizedBEnd = bEnd ?? Number.POSITIVE_INFINITY;
  return aStart < normalizedBEnd && bStart < normalizedAEnd;
}

export interface CalendarSlice {
  localDate: string;
  durationMs: number;
}

function localDateKey(instant: number, timezone: string): string {
  const value = new TZDate(instant, timezone);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function splitSessionByCalendarDay(
  session: WorkSession,
  timezone: string,
  nowUtc = Date.now(),
): CalendarSlice[] {
  const end = session.endedAtUtc ?? nowUtc;
  if (end <= session.startedAtUtc) return [];

  const startLocal = new TZDate(session.startedAtUtc, timezone);
  const endLocal = new TZDate(end, timezone);
  const dayCount = differenceInCalendarDays(endLocal, startLocal);
  const slices: CalendarSlice[] = [];

  for (let offset = 0; offset <= dayCount; offset += 1) {
    const day = addDays(startLocal, offset);
    const nextDay = new TZDate(
      day.getFullYear(),
      day.getMonth(),
      day.getDate() + 1,
      0,
      0,
      0,
      0,
      timezone,
    );
    const dayStart = new TZDate(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      0,
      0,
      0,
      0,
      timezone,
    );
    const sliceStart = Math.max(session.startedAtUtc, dayStart.getTime());
    const sliceEnd = Math.min(end, nextDay.getTime());
    if (sliceEnd > sliceStart) {
      slices.push({
        localDate: localDateKey(sliceStart, timezone),
        durationMs: sliceEnd - sliceStart,
      });
    }
  }

  return slices;
}

export function monthUtcRange(
  year: number,
  monthIndex: number,
  timezone: string,
): [number, number] {
  const reference = new TZDate(year, monthIndex, 15, timezone);
  const first = startOfMonth(reference);
  const last = endOfMonth(reference);
  const start = new TZDate(
    first.getFullYear(),
    first.getMonth(),
    first.getDate(),
    0,
    0,
    0,
    0,
    timezone,
  );
  const end = new TZDate(
    last.getFullYear(),
    last.getMonth(),
    last.getDate() + 1,
    0,
    0,
    0,
    0,
    timezone,
  );
  return [start.getTime(), end.getTime()];
}

export function formatDuration(durationMs: number): string {
  const totalMinutes = Math.floor(Math.max(0, durationMs) / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

export function dailyNetTotals(
  values: SessionWithBreaks[],
  timezone: string,
  nowUtc = Date.now(),
): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (key: string, amount: number) => totals.set(key, (totals.get(key) ?? 0) + amount);

  for (const value of values) {
    for (const slice of splitSessionByCalendarDay(value.session, timezone, nowUtc)) {
      add(slice.localDate, slice.durationMs);
    }
    for (const pause of value.breaks.filter((item) => !item.isPaid && !item.deletedAtUtc)) {
      const pauseAsSession: WorkSession = {
        ...value.session,
        id: pause.id,
        startedAtUtc: pause.startedAtUtc,
        ...(pause.endedAtUtc === undefined ? {} : { endedAtUtc: pause.endedAtUtc }),
      };
      for (const slice of splitSessionByCalendarDay(pauseAsSession, timezone, nowUtc)) {
        add(slice.localDate, -slice.durationMs);
      }
    }
  }
  for (const [key, value] of totals) totals.set(key, Math.max(0, value));
  return totals;
}

export interface PeriodSummary {
  workedMs: number;
  ordinaryMs: number;
  overtimeMs: number;
  missingMs: number;
  averageDailyMs: number;
  completedSessions: number;
  incompleteSessions: number;
}

export function summarizePeriod(
  values: SessionWithBreaks[],
  targetMinutes: number,
  expectedDays: number,
): PeriodSummary {
  const completed = values.filter(
    (value) => value.session.endedAtUtc && !value.session.deletedAtUtc,
  );
  const workedMs = completed.reduce((total, value) => total + netDurationMs(value), 0);
  const targetMs = targetMinutes * MINUTE_MS;
  const ordinaryMs = Math.min(workedMs, targetMs);
  return {
    workedMs,
    ordinaryMs,
    overtimeMs: Math.max(0, workedMs - targetMs),
    missingMs: Math.max(0, targetMs - workedMs),
    averageDailyMs: expectedDays > 0 ? workedMs / expectedDays : 0,
    completedSessions: completed.length,
    incompleteSessions: values.length - completed.length,
  };
}
