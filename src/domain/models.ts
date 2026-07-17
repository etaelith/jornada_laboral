export const sessionSources = ['BUTTON', 'MANUAL', 'IMPORT', 'RESTORED_BACKUP', 'SYNC'] as const;
export type SessionSource = (typeof sessionSources)[number];

export const sessionStatuses = [
  'OPEN',
  'COMPLETED',
  'INCOMPLETE',
  'MANUALLY_CREATED',
  'CORRECTED',
  'DELETED',
] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const dayClassificationTypes = [
  'WORKDAY',
  'DAY_OFF',
  'HOLIDAY',
  'VACATION',
  'SICK_LEAVE',
  'OTHER',
] as const;
export type DayClassificationType = (typeof dayClassificationTypes)[number];

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RoundingRule {
  incrementMinutes: 1 | 5 | 6 | 10 | 15 | 30;
  mode: 'NEAREST' | 'UP' | 'DOWN';
}

export interface WorkProfile {
  id: string;
  name: string;
  companyName?: string;
  expectedMinutesPerDay: number;
  expectedMinutesPerWeek: number;
  workDays: Weekday[];
  weekStartsOn: Weekday;
  timezone: string;
  roundingRule?: RoundingRule;
  createdAtUtc: number;
  updatedAtUtc: number;
}

export interface WorkSession {
  id: string;
  profileId: string;
  startedAtUtc: number;
  endedAtUtc?: number;
  startTimezone: string;
  endTimezone?: string;
  source: SessionSource;
  status: SessionStatus;
  note?: string;
  reviewFlags: ReviewFlag[];
  createdAtUtc: number;
  updatedAtUtc: number;
  deletedAtUtc?: number;
  rowVersion: number;
}

export interface BreakSession {
  id: string;
  workSessionId: string;
  startedAtUtc: number;
  endedAtUtc?: number;
  isPaid: boolean;
  note?: string;
  createdAtUtc: number;
  updatedAtUtc: number;
  deletedAtUtc?: number;
}

export type ReviewFlag =
  | 'MISSING_END'
  | 'OPEN_BREAK'
  | 'SESSION_OVERLAP'
  | 'BREAK_OVERLAP'
  | 'NEGATIVE_DURATION'
  | 'UNUSUALLY_LONG'
  | 'TIMEZONE_CHANGED'
  | 'POSSIBLE_DUPLICATE'
  | 'CLOCK_ROLLBACK';

export interface WorkSessionRevision {
  id: string;
  workSessionId: string;
  previousData: WorkSession;
  newData: WorkSession;
  reason: string;
  changedAtUtc: number;
  deviceId: string;
}

export interface DayClassification {
  id: string;
  profileId: string;
  localDate: string;
  type: DayClassificationType;
  note?: string;
}

export interface SessionWithBreaks {
  session: WorkSession;
  breaks: BreakSession[];
}
