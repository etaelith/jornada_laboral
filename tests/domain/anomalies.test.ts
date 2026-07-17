import { detectSessionAnomalies } from '@/domain/anomalies';
import { HOUR_MS } from '@/domain/calculations';
import type { SessionWithBreaks } from '@/domain/models';

const base: SessionWithBreaks = {
  session: {
    id: 'one',
    profileId: 'profile',
    startedAtUtc: 0,
    endedAtUtc: 20 * HOUR_MS,
    startTimezone: 'America/Argentina/Buenos_Aires',
    endTimezone: 'UTC',
    source: 'BUTTON',
    status: 'COMPLETED',
    reviewFlags: [],
    createdAtUtc: 0,
    updatedAtUtc: 0,
    rowVersion: 1,
  },
  breaks: [
    {
      id: 'break-one',
      workSessionId: 'one',
      startedAtUtc: HOUR_MS,
      isPaid: false,
      createdAtUtc: 0,
      updatedAtUtc: 0,
    },
  ],
};

test('marca datos dudosos sin corregirlos', () => {
  expect(detectSessionAnomalies(base)).toEqual(
    expect.arrayContaining(['UNUSUALLY_LONG', 'TIMEZONE_CHANGED', 'OPEN_BREAK']),
  );
  expect(base.session.endedAtUtc).toBe(20 * HOUR_MS);
});

test('marca sesiones superpuestas', () => {
  const peer: SessionWithBreaks = {
    session: { ...base.session, id: 'two', startedAtUtc: HOUR_MS, endedAtUtc: 2 * HOUR_MS },
    breaks: [],
  };
  expect(detectSessionAnomalies(base, [peer])).toContain('SESSION_OVERLAP');
});
