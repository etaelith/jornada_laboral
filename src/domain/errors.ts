export type DomainErrorCode =
  | 'OPEN_SESSION_EXISTS'
  | 'NO_OPEN_SESSION'
  | 'OPEN_BREAK_EXISTS'
  | 'NO_OPEN_BREAK'
  | 'OPEN_BREAK_PREVENTS_CLOCK_OUT'
  | 'END_BEFORE_START'
  | 'BREAK_OUTSIDE_SESSION'
  | 'BREAK_OVERLAP'
  | 'SESSION_OVERLAP'
  | 'NOT_FOUND'
  | 'KEY_UNAVAILABLE';

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
