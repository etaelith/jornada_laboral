import { HOUR_MS, summarizePeriod } from '@/domain/calculations';
import type { SessionWithBreaks } from '@/domain/models';

function completed(id: string, hours: number): SessionWithBreaks {
  return {
    session: {
      id,
      profileId: 'profile',
      startedAtUtc: 0,
      endedAtUtc: hours * HOUR_MS,
      startTimezone: 'UTC',
      source: 'BUTTON',
      status: 'COMPLETED',
      reviewFlags: [],
      createdAtUtc: 0,
      updatedAtUtc: 0,
      rowVersion: 1,
    },
    breaks: [],
  };
}

test('separa horas ordinarias, extra y faltantes', () => {
  const summary = summarizePeriod([completed('a', 9)], 8 * 60, 1);
  expect(summary.ordinaryMs).toBe(8 * HOUR_MS);
  expect(summary.overtimeMs).toBe(HOUR_MS);
  expect(summary.missingMs).toBe(0);
});

test('no cuenta una jornada abierta como completada', () => {
  const value = completed('a', 8);
  const { endedAtUtc: _endedAtUtc, ...openSession } = value.session;
  const summary = summarizePeriod(
    [{ ...value, session: { ...openSession, status: 'OPEN' } }],
    480,
    1,
  );
  expect(summary.workedMs).toBe(0);
  expect(summary.incompleteSessions).toBe(1);
});
