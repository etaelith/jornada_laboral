import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DomainError } from '@/domain/errors';
import type {
  BreakSession,
  DayClassification,
  DayClassificationType,
  SessionSource,
  SessionStatus,
  SessionWithBreaks,
  Weekday,
  WorkProfile,
  WorkSession,
  WorkSessionRevision,
} from '@/domain/models';
import type { EncryptionProvider } from '@/security/encryption';

interface ProfileRow {
  id: string;
  name_encrypted: Uint8Array;
  company_name_encrypted: Uint8Array | null;
  expected_minutes_per_day: number;
  expected_minutes_per_week: number;
  work_days_json: string;
  week_starts_on: Weekday;
  timezone: string;
  rounding_rule_json: string | null;
  created_at_utc: number;
  updated_at_utc: number;
}

interface SessionRow {
  id: string;
  profile_id: string;
  started_at_utc: number;
  ended_at_utc: number | null;
  start_timezone: string;
  end_timezone: string | null;
  source: SessionSource;
  status: SessionStatus;
  note_encrypted: Uint8Array | null;
  review_flags_json: string;
  created_at_utc: number;
  updated_at_utc: number;
  deleted_at_utc: number | null;
  row_version: number;
}

interface BreakRow {
  id: string;
  work_session_id: string;
  started_at_utc: number;
  ended_at_utc: number | null;
  is_paid: number;
  note_encrypted: Uint8Array | null;
  created_at_utc: number;
  updated_at_utc: number;
  deleted_at_utc: number | null;
}

function bytes(value: Uint8Array | ArrayBuffer): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

export class AppRepository {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly encryption: EncryptionProvider,
    private readonly deviceId: string,
  ) {}

  runInTransaction(operation: () => Promise<void>): Promise<void> {
    return this.db.withTransactionAsync(operation);
  }

  async ensureDefaultProfile(timezone: string): Promise<WorkProfile> {
    const existing = await this.getDefaultProfile();
    if (existing) return existing;
    const now = Date.now();
    const profile: WorkProfile = {
      id: randomUUID(),
      name: 'Mi trabajo',
      expectedMinutesPerDay: 480,
      expectedMinutesPerWeek: 2400,
      workDays: [1, 2, 3, 4, 5],
      weekStartsOn: 1,
      timezone,
      createdAtUtc: now,
      updatedAtUtc: now,
    };
    await this.saveProfile(profile);
    return profile;
  }

  async getDefaultProfile(): Promise<WorkProfile | null> {
    const row = await this.db.getFirstAsync<ProfileRow>(
      'SELECT * FROM work_profiles WHERE deleted_at_utc IS NULL ORDER BY created_at_utc LIMIT 1',
    );
    return row ? this.mapProfile(row) : null;
  }

  async saveProfile(profile: WorkProfile): Promise<void> {
    const name = await this.encryption.encryptString(profile.name, `profile:${profile.id}:name`);
    const company = profile.companyName
      ? await this.encryption.encryptString(profile.companyName, `profile:${profile.id}:company`)
      : null;
    await this.db.runAsync(
      `INSERT INTO work_profiles(
        id,name_encrypted,company_name_encrypted,expected_minutes_per_day,
        expected_minutes_per_week,work_days_json,week_starts_on,timezone,
        rounding_rule_json,created_at_utc,updated_at_utc,row_version
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(id) DO UPDATE SET
        name_encrypted=excluded.name_encrypted,
        company_name_encrypted=excluded.company_name_encrypted,
        expected_minutes_per_day=excluded.expected_minutes_per_day,
        expected_minutes_per_week=excluded.expected_minutes_per_week,
        work_days_json=excluded.work_days_json,
        week_starts_on=excluded.week_starts_on,
        timezone=excluded.timezone,
        rounding_rule_json=excluded.rounding_rule_json,
        updated_at_utc=excluded.updated_at_utc,
        row_version=row_version+1`,
      profile.id,
      name,
      company,
      profile.expectedMinutesPerDay,
      profile.expectedMinutesPerWeek,
      JSON.stringify(profile.workDays),
      profile.weekStartsOn,
      profile.timezone,
      profile.roundingRule ? JSON.stringify(profile.roundingRule) : null,
      profile.createdAtUtc,
      profile.updatedAtUtc,
    );
  }

  async getOpenSession(profileId: string): Promise<SessionWithBreaks | null> {
    const row = await this.db.getFirstAsync<SessionRow>(
      `SELECT * FROM work_sessions
       WHERE profile_id=? AND ended_at_utc IS NULL AND deleted_at_utc IS NULL AND status='OPEN'
       LIMIT 1`,
      profileId,
    );
    if (!row) return null;
    const session = await this.mapSession(row);
    return { session, breaks: await this.getBreaks(session.id) };
  }

  async getSession(id: string): Promise<SessionWithBreaks | null> {
    const row = await this.db.getFirstAsync<SessionRow>(
      'SELECT * FROM work_sessions WHERE id=? AND deleted_at_utc IS NULL',
      id,
    );
    if (!row) return null;
    return { session: await this.mapSession(row), breaks: await this.getBreaks(id) };
  }

  async listSessions(
    profileId: string,
    fromUtc: number,
    toUtc: number,
    limit = 200,
  ): Promise<SessionWithBreaks[]> {
    const rows = await this.db.getAllAsync<SessionRow>(
      `SELECT * FROM work_sessions
       WHERE profile_id=? AND started_at_utc < ?
         AND COALESCE(ended_at_utc, ?) >= ? AND deleted_at_utc IS NULL
       ORDER BY started_at_utc DESC LIMIT ?`,
      profileId,
      toUtc,
      toUtc,
      fromUtc,
      limit,
    );
    return Promise.all(
      rows.map(async (row) => {
        const session = await this.mapSession(row);
        return { session, breaks: await this.getBreaks(session.id) };
      }),
    );
  }

  async startSession(
    profileId: string,
    startedAtUtc: number,
    timezone: string,
    operationId: string,
  ): Promise<SessionWithBreaks> {
    const id = randomUUID();
    try {
      await this.db.runAsync(
        `INSERT INTO work_sessions(
          id,profile_id,started_at_utc,start_timezone,source,status,operation_id,
          review_flags_json,created_at_utc,updated_at_utc,row_version
        ) VALUES (?,?,?,?,?,'OPEN',?,'[]',?,?,1)`,
        id,
        profileId,
        startedAtUtc,
        timezone,
        'BUTTON',
        operationId,
        startedAtUtc,
        startedAtUtc,
      );
    } catch (error) {
      const duplicate = await this.getOpenSession(profileId);
      if (duplicate) return duplicate;
      throw error;
    }
    const created = await this.getSession(id);
    if (!created) throw new DomainError('NOT_FOUND', 'No se pudo recuperar la jornada creada.');
    return created;
  }

  async stopSession(
    sessionId: string,
    endedAtUtc: number,
    timezone: string,
  ): Promise<SessionWithBreaks> {
    const current = await this.getSession(sessionId);
    if (!current) throw new DomainError('NO_OPEN_SESSION', 'No hay una jornada abierta.');
    if (current.session.endedAtUtc) return current;
    if (endedAtUtc < current.session.startedAtUtc) {
      throw new DomainError('END_BEFORE_START', 'La salida no puede ser anterior a la entrada.');
    }
    if (current.breaks.some((item) => !item.endedAtUtc)) {
      throw new DomainError(
        'OPEN_BREAK_PREVENTS_CLOCK_OUT',
        'Finalizá la pausa antes de marcar la salida.',
      );
    }
    await this.db.runAsync(
      `UPDATE work_sessions SET ended_at_utc=?,end_timezone=?,status='COMPLETED',updated_at_utc=?,
       review_flags_json=?,row_version=row_version+1 WHERE id=? AND ended_at_utc IS NULL`,
      endedAtUtc,
      timezone,
      endedAtUtc,
      JSON.stringify(timezone === current.session.startTimezone ? [] : ['TIMEZONE_CHANGED']),
      sessionId,
    );
    const updated = await this.getSession(sessionId);
    if (!updated) throw new DomainError('NOT_FOUND', 'No se pudo recuperar la jornada finalizada.');
    return updated;
  }

  async startBreak(
    sessionId: string,
    startedAtUtc: number,
    isPaid: boolean,
  ): Promise<BreakSession> {
    const session = await this.getSession(sessionId);
    if (!session || session.session.endedAtUtc) {
      throw new DomainError('NO_OPEN_SESSION', 'No hay una jornada abierta.');
    }
    if (session.breaks.some((item) => !item.endedAtUtc)) {
      throw new DomainError('OPEN_BREAK_EXISTS', 'Ya existe una pausa abierta.');
    }
    const id = randomUUID();
    await this.db.runAsync(
      `INSERT INTO break_sessions(
        id,work_session_id,started_at_utc,is_paid,created_at_utc,updated_at_utc
      ) VALUES (?,?,?,?,?,?)`,
      id,
      sessionId,
      startedAtUtc,
      isPaid ? 1 : 0,
      startedAtUtc,
      startedAtUtc,
    );
    const row = await this.db.getFirstAsync<BreakRow>(
      'SELECT * FROM break_sessions WHERE id=?',
      id,
    );
    if (!row) throw new DomainError('NOT_FOUND', 'No se pudo recuperar la pausa.');
    return this.mapBreak(row);
  }

  async stopBreak(sessionId: string, endedAtUtc: number): Promise<BreakSession> {
    const row = await this.db.getFirstAsync<BreakRow>(
      `SELECT * FROM break_sessions
       WHERE work_session_id=? AND ended_at_utc IS NULL AND deleted_at_utc IS NULL
       ORDER BY started_at_utc DESC LIMIT 1`,
      sessionId,
    );
    if (!row) throw new DomainError('NO_OPEN_BREAK', 'No hay una pausa abierta.');
    if (endedAtUtc < row.started_at_utc) {
      throw new DomainError('END_BEFORE_START', 'El fin de pausa no puede ser anterior.');
    }
    await this.db.runAsync(
      'UPDATE break_sessions SET ended_at_utc=?,updated_at_utc=? WHERE id=?',
      endedAtUtc,
      endedAtUtc,
      row.id,
    );
    return { ...this.mapBreak(row), endedAtUtc, updatedAtUtc: endedAtUtc };
  }

  async addManualBreak(
    sessionId: string,
    startedAtUtc: number,
    endedAtUtc: number,
    isPaid: boolean,
  ): Promise<BreakSession> {
    const session = await this.getSession(sessionId);
    if (!session) throw new DomainError('NOT_FOUND', 'No se encontró la jornada.');
    if (
      endedAtUtc < startedAtUtc ||
      startedAtUtc < session.session.startedAtUtc ||
      (session.session.endedAtUtc !== undefined && endedAtUtc > session.session.endedAtUtc)
    ) {
      throw new DomainError('BREAK_OUTSIDE_SESSION', 'La pausa debe estar dentro de la jornada.');
    }
    const id = randomUUID();
    await this.db.runAsync(
      `INSERT INTO break_sessions(
        id,work_session_id,started_at_utc,ended_at_utc,is_paid,created_at_utc,updated_at_utc
      ) VALUES (?,?,?,?,?,?,?)`,
      id,
      sessionId,
      startedAtUtc,
      endedAtUtc,
      isPaid ? 1 : 0,
      Date.now(),
      Date.now(),
    );
    return {
      id,
      workSessionId: sessionId,
      startedAtUtc,
      endedAtUtc,
      isPaid,
      createdAtUtc: Date.now(),
      updatedAtUtc: Date.now(),
    };
  }

  async createManualSession(
    profileId: string,
    startedAtUtc: number,
    endedAtUtc: number,
    timezone: string,
    note?: string,
    source: SessionSource = 'MANUAL',
  ): Promise<SessionWithBreaks> {
    if (endedAtUtc < startedAtUtc) {
      throw new DomainError('END_BEFORE_START', 'La salida no puede ser anterior a la entrada.');
    }
    const id = randomUUID();
    const noteEncrypted = note
      ? await this.encryption.encryptString(note, `session:${id}:note`)
      : null;
    await this.db.runAsync(
      `INSERT INTO work_sessions(
        id,profile_id,started_at_utc,ended_at_utc,start_timezone,end_timezone,source,status,
        note_encrypted,operation_id,review_flags_json,created_at_utc,updated_at_utc,row_version
      ) VALUES (?,?,?,?,?,?,?,?,?,?, '[]',?,?,1)`,
      id,
      profileId,
      startedAtUtc,
      endedAtUtc,
      timezone,
      timezone,
      source,
      source === 'MANUAL' ? 'MANUALLY_CREATED' : 'COMPLETED',
      noteEncrypted,
      randomUUID(),
      Date.now(),
      Date.now(),
    );
    const result = await this.getSession(id);
    if (!result) throw new DomainError('NOT_FOUND', 'No se pudo recuperar la jornada manual.');
    return result;
  }

  async updateSession(
    id: string,
    changes: Pick<WorkSession, 'startedAtUtc' | 'endedAtUtc' | 'note'>,
    reason: string,
  ): Promise<SessionWithBreaks> {
    const previous = await this.getSession(id);
    if (!previous) throw new DomainError('NOT_FOUND', 'No se encontró la jornada.');
    if (changes.endedAtUtc !== undefined && changes.endedAtUtc < changes.startedAtUtc) {
      throw new DomainError('END_BEFORE_START', 'La salida no puede ser anterior a la entrada.');
    }
    const now = Date.now();
    const next: WorkSession = {
      ...previous.session,
      startedAtUtc: changes.startedAtUtc,
      ...(changes.endedAtUtc === undefined ? {} : { endedAtUtc: changes.endedAtUtc }),
      ...(changes.note === undefined ? {} : { note: changes.note }),
      status: 'CORRECTED',
      updatedAtUtc: now,
      rowVersion: previous.session.rowVersion + 1,
    };
    const revisionId = randomUUID();
    const [oldPayload, newPayload, encryptedReason, noteEncrypted] = await Promise.all([
      this.encryption.encryptString(JSON.stringify(previous.session), `revision:${revisionId}:old`),
      this.encryption.encryptString(JSON.stringify(next), `revision:${revisionId}:new`),
      this.encryption.encryptString(reason, `revision:${revisionId}:reason`),
      changes.note
        ? this.encryption.encryptString(changes.note, `session:${id}:note`)
        : Promise.resolve(null),
    ]);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO work_session_revisions(
          id,work_session_id,previous_data_encrypted,new_data_encrypted,reason_encrypted,
          changed_at_utc,device_id,schema_version
        ) VALUES (?,?,?,?,?,?,?,1)`,
        revisionId,
        id,
        oldPayload,
        newPayload,
        encryptedReason,
        now,
        this.deviceId,
      );
      await this.db.runAsync(
        `UPDATE work_sessions SET started_at_utc=?,ended_at_utc=?,status='CORRECTED',
         note_encrypted=?,updated_at_utc=?,row_version=row_version+1 WHERE id=?`,
        changes.startedAtUtc,
        changes.endedAtUtc ?? null,
        noteEncrypted,
        now,
        id,
      );
    });
    const updated = await this.getSession(id);
    if (!updated) throw new DomainError('NOT_FOUND', 'No se pudo recuperar la corrección.');
    return updated;
  }

  async softDeleteSession(id: string, reason: string): Promise<void> {
    const current = await this.getSession(id);
    if (!current) throw new DomainError('NOT_FOUND', 'No se encontró la jornada.');
    const now = Date.now();
    const next = { ...current.session, status: 'DELETED' as const, deletedAtUtc: now };
    const revisionId = randomUUID();
    const [oldPayload, newPayload, encryptedReason] = await Promise.all([
      this.encryption.encryptString(JSON.stringify(current.session), `revision:${revisionId}:old`),
      this.encryption.encryptString(JSON.stringify(next), `revision:${revisionId}:new`),
      this.encryption.encryptString(reason, `revision:${revisionId}:reason`),
    ]);
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO work_session_revisions(
          id,work_session_id,previous_data_encrypted,new_data_encrypted,reason_encrypted,
          changed_at_utc,device_id,schema_version
        ) VALUES (?,?,?,?,?,?,?,1)`,
        revisionId,
        id,
        oldPayload,
        newPayload,
        encryptedReason,
        now,
        this.deviceId,
      );
      await this.db.runAsync(
        `UPDATE work_sessions SET status='DELETED',deleted_at_utc=?,updated_at_utc=?,
         row_version=row_version+1 WHERE id=?`,
        now,
        now,
        id,
      );
    });
  }

  async listRevisions(sessionId: string): Promise<WorkSessionRevision[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      previous_data_encrypted: Uint8Array;
      new_data_encrypted: Uint8Array;
      reason_encrypted: Uint8Array;
      changed_at_utc: number;
      device_id: string;
    }>(
      'SELECT * FROM work_session_revisions WHERE work_session_id=? ORDER BY changed_at_utc DESC',
      sessionId,
    );
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        workSessionId: sessionId,
        previousData: JSON.parse(
          await this.encryption.decryptString(
            bytes(row.previous_data_encrypted),
            `revision:${row.id}:old`,
          ),
        ) as WorkSession,
        newData: JSON.parse(
          await this.encryption.decryptString(
            bytes(row.new_data_encrypted),
            `revision:${row.id}:new`,
          ),
        ) as WorkSession,
        reason: await this.encryption.decryptString(
          bytes(row.reason_encrypted),
          `revision:${row.id}:reason`,
        ),
        changedAtUtc: row.changed_at_utc,
        deviceId: row.device_id,
      })),
    );
  }

  async setDayClassification(
    profileId: string,
    localDate: string,
    type: DayClassificationType,
    note?: string,
  ): Promise<DayClassification> {
    const existing = await this.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM day_classifications
       WHERE profile_id=? AND local_date=? AND deleted_at_utc IS NULL`,
      profileId,
      localDate,
    );
    const id = existing?.id ?? randomUUID();
    const encrypted = note
      ? await this.encryption.encryptString(note, `classification:${id}:note`)
      : null;
    const now = Date.now();
    await this.db.runAsync(
      `INSERT INTO day_classifications(
        id,profile_id,local_date,type,note_encrypted,created_at_utc,updated_at_utc
      ) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET type=excluded.type,note_encrypted=excluded.note_encrypted,
        updated_at_utc=excluded.updated_at_utc`,
      id,
      profileId,
      localDate,
      type,
      encrypted,
      now,
      now,
    );
    return { id, profileId, localDate, type, ...(note === undefined ? {} : { note }) };
  }

  async restoreSessions(
    profileId: string,
    values: SessionWithBreaks[],
    mode: 'MERGE' | 'REPLACE',
  ): Promise<number> {
    let restored = 0;
    await this.db.withTransactionAsync(async () => {
      if (mode === 'REPLACE') {
        const active = await this.db.getAllAsync<SessionRow>(
          'SELECT * FROM work_sessions WHERE profile_id=? AND deleted_at_utc IS NULL',
          profileId,
        );
        for (const row of active) {
          const current = await this.mapSession(row);
          const now = Date.now();
          const revisionId = randomUUID();
          const next = { ...current, status: 'DELETED' as const, deletedAtUtc: now };
          const [oldPayload, newPayload, reason] = await Promise.all([
            this.encryption.encryptString(JSON.stringify(current), `revision:${revisionId}:old`),
            this.encryption.encryptString(JSON.stringify(next), `revision:${revisionId}:new`),
            this.encryption.encryptString(
              'Reemplazo por restauración',
              `revision:${revisionId}:reason`,
            ),
          ]);
          await this.db.runAsync(
            `INSERT INTO work_session_revisions(
              id,work_session_id,previous_data_encrypted,new_data_encrypted,reason_encrypted,
              changed_at_utc,device_id,schema_version
            ) VALUES (?,?,?,?,?,?,?,1)`,
            revisionId,
            current.id,
            oldPayload,
            newPayload,
            reason,
            now,
            this.deviceId,
          );
          await this.db.runAsync(
            `UPDATE work_sessions SET status='DELETED',deleted_at_utc=?,updated_at_utc=?,
             row_version=row_version+1 WHERE id=?`,
            now,
            now,
            current.id,
          );
        }
      }
      for (const value of values) {
        if (mode === 'MERGE') {
          const end = value.session.endedAtUtc ?? Date.now();
          const duplicate = await this.db.getFirstAsync<{ id: string }>(
            `SELECT id FROM work_sessions WHERE profile_id=? AND deleted_at_utc IS NULL
             AND started_at_utc < ? AND COALESCE(ended_at_utc, ?) > ? LIMIT 1`,
            profileId,
            end,
            end,
            value.session.startedAtUtc,
          );
          if (duplicate) continue;
        }
        const created = await this.createManualSession(
          profileId,
          value.session.startedAtUtc,
          value.session.endedAtUtc ?? value.session.startedAtUtc,
          value.session.startTimezone,
          value.session.note,
          'RESTORED_BACKUP',
        );
        for (const pause of value.breaks) {
          if (pause.endedAtUtc) {
            await this.addManualBreak(
              created.session.id,
              pause.startedAtUtc,
              pause.endedAtUtc,
              pause.isPaid,
            );
          }
        }
        restored += 1;
      }
    });
    return restored;
  }

  private async getBreaks(sessionId: string): Promise<BreakSession[]> {
    const rows = await this.db.getAllAsync<BreakRow>(
      `SELECT * FROM break_sessions
       WHERE work_session_id=? AND deleted_at_utc IS NULL ORDER BY started_at_utc`,
      sessionId,
    );
    return Promise.all(rows.map((row) => this.mapBreakAsync(row)));
  }

  private async mapProfile(row: ProfileRow): Promise<WorkProfile> {
    const [name, companyName] = await Promise.all([
      this.encryption.decryptString(bytes(row.name_encrypted), `profile:${row.id}:name`),
      row.company_name_encrypted
        ? this.encryption.decryptString(
            bytes(row.company_name_encrypted),
            `profile:${row.id}:company`,
          )
        : Promise.resolve(undefined),
    ]);
    return {
      id: row.id,
      name,
      ...(companyName === undefined ? {} : { companyName }),
      expectedMinutesPerDay: row.expected_minutes_per_day,
      expectedMinutesPerWeek: row.expected_minutes_per_week,
      workDays: JSON.parse(row.work_days_json) as Weekday[],
      weekStartsOn: row.week_starts_on,
      timezone: row.timezone,
      ...(row.rounding_rule_json ? { roundingRule: JSON.parse(row.rounding_rule_json) } : {}),
      createdAtUtc: row.created_at_utc,
      updatedAtUtc: row.updated_at_utc,
    };
  }

  private async mapSession(row: SessionRow): Promise<WorkSession> {
    const note = row.note_encrypted
      ? await this.encryption.decryptString(bytes(row.note_encrypted), `session:${row.id}:note`)
      : undefined;
    return {
      id: row.id,
      profileId: row.profile_id,
      startedAtUtc: row.started_at_utc,
      ...(row.ended_at_utc === null ? {} : { endedAtUtc: row.ended_at_utc }),
      startTimezone: row.start_timezone,
      ...(row.end_timezone === null ? {} : { endTimezone: row.end_timezone }),
      source: row.source,
      status: row.status,
      ...(note === undefined ? {} : { note }),
      reviewFlags: JSON.parse(row.review_flags_json),
      createdAtUtc: row.created_at_utc,
      updatedAtUtc: row.updated_at_utc,
      ...(row.deleted_at_utc === null ? {} : { deletedAtUtc: row.deleted_at_utc }),
      rowVersion: row.row_version,
    };
  }

  private mapBreak(row: BreakRow): BreakSession {
    return {
      id: row.id,
      workSessionId: row.work_session_id,
      startedAtUtc: row.started_at_utc,
      ...(row.ended_at_utc === null ? {} : { endedAtUtc: row.ended_at_utc }),
      isPaid: row.is_paid === 1,
      createdAtUtc: row.created_at_utc,
      updatedAtUtc: row.updated_at_utc,
      ...(row.deleted_at_utc === null ? {} : { deletedAtUtc: row.deleted_at_utc }),
    };
  }

  private async mapBreakAsync(row: BreakRow): Promise<BreakSession> {
    const base = this.mapBreak(row);
    if (!row.note_encrypted) return base;
    return {
      ...base,
      note: await this.encryption.decryptString(bytes(row.note_encrypted), `break:${row.id}:note`),
    };
  }
}
