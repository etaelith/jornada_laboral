import {
  HOUR_MS,
  MINUTE_MS,
  grossDurationMs,
  intervalsOverlap,
  netDurationMs,
  roundMinutes,
  splitSessionByCalendarDay,
} from '@/domain/calculations';
import type { SessionWithBreaks, WorkSession } from '@/domain/models';

function session(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: 'session-1',
    profileId: 'profile-1',
    startedAtUtc: 0,
    endedAtUtc: 8 * HOUR_MS,
    startTimezone: 'UTC',
    endTimezone: 'UTC',
    source: 'BUTTON',
    status: 'COMPLETED',
    reviewFlags: [],
    createdAtUtc: 0,
    updatedAtUtc: 0,
    rowVersion: 1,
    ...overrides,
  };
}

describe('cálculos de jornadas', () => {
  test('calcula duración bruta y neta descontando solo pausas no pagas', () => {
    const value: SessionWithBreaks = {
      session: session(),
      breaks: [
        {
          id: 'b1',
          workSessionId: 'session-1',
          startedAtUtc: HOUR_MS,
          endedAtUtc: HOUR_MS + 30 * MINUTE_MS,
          isPaid: false,
          createdAtUtc: 0,
          updatedAtUtc: 0,
        },
        {
          id: 'b2',
          workSessionId: 'session-1',
          startedAtUtc: 2 * HOUR_MS,
          endedAtUtc: 2 * HOUR_MS + 15 * MINUTE_MS,
          isPaid: true,
          createdAtUtc: 0,
          updatedAtUtc: 0,
        },
      ],
    };
    expect(grossDurationMs(value.session)).toBe(8 * HOUR_MS);
    expect(netDurationMs(value)).toBe(7.5 * HOUR_MS);
  });

  test('una jornada abierta usa la hora actual solo de forma provisional', () => {
    const { endedAtUtc: _endedAtUtc, ...open } = session({ status: 'OPEN' });
    expect(grossDurationMs(open, 3 * HOUR_MS)).toBe(3 * HOUR_MS);
  });

  test('divide correctamente una jornada que cruza medianoche', () => {
    const start = Date.parse('2026-07-16T23:00:00.000Z');
    const end = Date.parse('2026-07-17T02:00:00.000Z');
    const slices = splitSessionByCalendarDay(
      session({ startedAtUtc: start, endedAtUtc: end }),
      'UTC',
    );
    expect(slices).toEqual([
      { localDate: '2026-07-16', durationMs: HOUR_MS },
      { localDate: '2026-07-17', durationMs: 2 * HOUR_MS },
    ]);
  });

  test('respeta el cambio de horario de verano al dividir', () => {
    const start = Date.parse('2026-03-08T06:30:00.000Z');
    const end = Date.parse('2026-03-08T08:30:00.000Z');
    const slices = splitSessionByCalendarDay(
      session({ startedAtUtc: start, endedAtUtc: end }),
      'America/New_York',
    );
    expect(slices).toEqual([{ localDate: '2026-03-08', durationMs: 2 * HOUR_MS }]);
  });

  test('detecta solapamientos sin considerar extremos adyacentes', () => {
    expect(intervalsOverlap(0, 10, 9, 20)).toBe(true);
    expect(intervalsOverlap(0, 10, 10, 20)).toBe(false);
    expect(intervalsOverlap(0, undefined, 20, 30)).toBe(true);
  });

  test('aplica reglas de redondeo', () => {
    expect(roundMinutes(487, { incrementMinutes: 15, mode: 'NEAREST' })).toBe(480);
    expect(roundMinutes(481, { incrementMinutes: 15, mode: 'UP' })).toBe(495);
    expect(roundMinutes(494, { incrementMinutes: 15, mode: 'DOWN' })).toBe(480);
  });
});
