import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at_utc INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS work_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        name_encrypted BLOB NOT NULL,
        company_name_encrypted BLOB,
        expected_minutes_per_day INTEGER NOT NULL CHECK(expected_minutes_per_day >= 0),
        expected_minutes_per_week INTEGER NOT NULL CHECK(expected_minutes_per_week >= 0),
        work_days_json TEXT NOT NULL,
        week_starts_on INTEGER NOT NULL CHECK(week_starts_on BETWEEN 0 AND 6),
        timezone TEXT NOT NULL,
        rounding_rule_json TEXT,
        created_at_utc INTEGER NOT NULL,
        updated_at_utc INTEGER NOT NULL,
        deleted_at_utc INTEGER,
        row_version INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS work_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL REFERENCES work_profiles(id),
        started_at_utc INTEGER NOT NULL,
        ended_at_utc INTEGER,
        start_timezone TEXT NOT NULL,
        end_timezone TEXT,
        source TEXT NOT NULL CHECK(source IN ('BUTTON','MANUAL','IMPORT','RESTORED_BACKUP','SYNC')),
        status TEXT NOT NULL CHECK(status IN ('OPEN','COMPLETED','INCOMPLETE','MANUALLY_CREATED','CORRECTED','DELETED')),
        note_encrypted BLOB,
        operation_id TEXT NOT NULL UNIQUE,
        review_flags_json TEXT NOT NULL DEFAULT '[]',
        created_at_utc INTEGER NOT NULL,
        updated_at_utc INTEGER NOT NULL,
        deleted_at_utc INTEGER,
        row_version INTEGER NOT NULL DEFAULT 1,
        CHECK(ended_at_utc IS NULL OR ended_at_utc >= started_at_utc)
      );

      CREATE TABLE IF NOT EXISTS break_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        work_session_id TEXT NOT NULL REFERENCES work_sessions(id),
        started_at_utc INTEGER NOT NULL,
        ended_at_utc INTEGER,
        is_paid INTEGER NOT NULL CHECK(is_paid IN (0,1)),
        note_encrypted BLOB,
        created_at_utc INTEGER NOT NULL,
        updated_at_utc INTEGER NOT NULL,
        deleted_at_utc INTEGER,
        CHECK(ended_at_utc IS NULL OR ended_at_utc >= started_at_utc)
      );

      CREATE TABLE IF NOT EXISTS work_session_revisions (
        id TEXT PRIMARY KEY NOT NULL,
        work_session_id TEXT NOT NULL REFERENCES work_sessions(id),
        previous_data_encrypted BLOB NOT NULL,
        new_data_encrypted BLOB NOT NULL,
        reason_encrypted BLOB NOT NULL,
        changed_at_utc INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS day_classifications (
        id TEXT PRIMARY KEY NOT NULL,
        profile_id TEXT NOT NULL REFERENCES work_profiles(id),
        local_date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('WORKDAY','DAY_OFF','HOLIDAY','VACATION','SICK_LEAVE','OTHER')),
        note_encrypted BLOB,
        created_at_utc INTEGER NOT NULL,
        updated_at_utc INTEGER NOT NULL,
        deleted_at_utc INTEGER
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY NOT NULL CHECK(id = 'app'),
        biometric_lock_enabled INTEGER NOT NULL DEFAULT 0,
        theme TEXT NOT NULL DEFAULT 'SYSTEM',
        language TEXT NOT NULL DEFAULT 'es',
        time_format TEXT NOT NULL DEFAULT '24H',
        first_day_of_week INTEGER NOT NULL DEFAULT 1,
        export_preferences_json TEXT NOT NULL DEFAULT '{}',
        reminder_preferences_json TEXT NOT NULL DEFAULT '{}',
        reduced_effects INTEGER NOT NULL DEFAULT 0,
        updated_at_utc INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_profile ON work_sessions(profile_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON work_sessions(started_at_utc);
      CREATE INDEX IF NOT EXISTS idx_sessions_ended ON work_sessions(ended_at_utc);
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON work_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_deleted ON work_sessions(deleted_at_utc);
      CREATE INDEX IF NOT EXISTS idx_sessions_profile_started ON work_sessions(profile_id, started_at_utc);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_profile
        ON work_sessions(profile_id)
        WHERE ended_at_utc IS NULL AND deleted_at_utc IS NULL AND status = 'OPEN';
      CREATE INDEX IF NOT EXISTS idx_breaks_session_started ON break_sessions(work_session_id, started_at_utc);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_classification_profile_date
        ON day_classifications(profile_id, local_date)
        WHERE deleted_at_utc IS NULL;
    `,
  },
] as const;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at_utc INTEGER NOT NULL);',
  );
  const row = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  const current = row?.version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      await db.runAsync(
        'INSERT INTO schema_migrations(version, name, applied_at_utc) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        Date.now(),
      );
    });
  }
}
