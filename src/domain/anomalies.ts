import { HOUR_MS, intervalsOverlap } from './calculations';
import type { BreakSession, ReviewFlag, SessionWithBreaks } from './models';

export function detectSessionAnomalies(
  value: SessionWithBreaks,
  peers: SessionWithBreaks[] = [],
  unusuallyLongHours = 16,
): ReviewFlag[] {
  const { session, breaks } = value;
  const flags = new Set<ReviewFlag>();
  if (!session.endedAtUtc) flags.add('MISSING_END');
  if (session.endedAtUtc !== undefined && session.endedAtUtc < session.startedAtUtc) {
    flags.add('NEGATIVE_DURATION');
  }
  if (
    session.endedAtUtc !== undefined &&
    session.endedAtUtc - session.startedAtUtc > unusuallyLongHours * HOUR_MS
  ) {
    flags.add('UNUSUALLY_LONG');
  }
  if (session.endTimezone && session.endTimezone !== session.startTimezone) {
    flags.add('TIMEZONE_CHANGED');
  }
  if (breaks.some((item) => !item.endedAtUtc)) flags.add('OPEN_BREAK');
  if (hasOverlappingBreaks(breaks)) flags.add('BREAK_OVERLAP');
  if (
    peers.some(
      ({ session: peer }) =>
        peer.id !== session.id &&
        !peer.deletedAtUtc &&
        intervalsOverlap(
          session.startedAtUtc,
          session.endedAtUtc,
          peer.startedAtUtc,
          peer.endedAtUtc,
        ),
    )
  ) {
    flags.add('SESSION_OVERLAP');
  }
  return [...flags];
}

function hasOverlappingBreaks(breaks: BreakSession[]): boolean {
  const active = breaks.filter((item) => !item.deletedAtUtc);
  return active.some((item, index) =>
    active
      .slice(index + 1)
      .some((other) =>
        intervalsOverlap(item.startedAtUtc, item.endedAtUtc, other.startedAtUtc, other.endedAtUtc),
      ),
  );
}
