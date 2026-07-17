import { File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { loadOrCreateKeyring } from '@/security/key-manager';

import { migrateDatabase } from './migrations';

const DATABASE_NAME = 'jornada.db';

export interface DatabaseContext {
  db: SQLite.SQLiteDatabase;
  fieldKeyBase64: string;
  keyId: string;
}

let contextPromise: Promise<DatabaseContext> | undefined;

export function openAppDatabase(): Promise<DatabaseContext> {
  contextPromise ??= initializeDatabase();
  return contextPromise;
}

async function initializeDatabase(): Promise<DatabaseContext> {
  const databaseFile = new File(Paths.document, 'SQLite', DATABASE_NAME);
  const keyring = await loadOrCreateKeyring(databaseFile.exists);
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(
    `PRAGMA key = \"x'${keyring.databaseKeyHex}'\"; PRAGMA cipher_memory_security = ON;`,
  );
  await migrateDatabase(db);
  return { db, fieldKeyBase64: keyring.fieldKeyBase64, keyId: keyring.keyId };
}
