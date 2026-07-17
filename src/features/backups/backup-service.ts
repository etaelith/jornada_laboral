import { Buffer } from 'buffer';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytesAsync,
} from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import type { SessionWithBreaks, WorkProfile } from '@/domain/models';

const ITERATIONS = 600_000;
const AAD = new TextEncoder().encode('jornada-backup:v1');

interface BackupPayload {
  profile: WorkProfile;
  sessions: SessionWithBreaks[];
}

interface BackupEnvelope {
  formatVersion: 1;
  createdAtUtc: number;
  kdf: {
    algorithm: 'PBKDF2-HMAC-SHA256';
    iterations: number;
    saltBase64: string;
  };
  encryption: {
    algorithm: 'AES-256-GCM';
    nonceBase64: string;
    ciphertextBase64: string;
    authenticationTagBase64: string;
  };
  metadata: {
    profiles: number;
    sessions: number;
  };
}

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<AESEncryptionKey> {
  if (password.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.');
  const derived = await pbkdf2Async(sha256, new TextEncoder().encode(password), salt, {
    c: iterations,
    dkLen: 32,
    asyncTick: 10,
  });
  return AESEncryptionKey.import(base64(derived), 'base64');
}

export async function createEncryptedBackup(
  payload: BackupPayload,
  password: string,
): Promise<string> {
  const salt = await getRandomBytesAsync(16);
  const key = await deriveKey(password, salt, ITERATIONS);
  const sealed = await aesEncryptAsync(new TextEncoder().encode(JSON.stringify(payload)), key, {
    additionalData: AAD,
    nonce: { length: 12 },
    tagLength: 16,
  });
  const envelope: BackupEnvelope = {
    formatVersion: 1,
    createdAtUtc: Date.now(),
    kdf: {
      algorithm: 'PBKDF2-HMAC-SHA256',
      iterations: ITERATIONS,
      saltBase64: base64(salt),
    },
    encryption: {
      algorithm: 'AES-256-GCM',
      nonceBase64: await sealed.iv('base64'),
      ciphertextBase64: await sealed.ciphertext({ encoding: 'base64' }),
      authenticationTagBase64: await sealed.tag('base64'),
    },
    metadata: { profiles: 1, sessions: payload.sessions.length },
  };
  const directory = new Directory(Paths.document, 'backups');
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `jornada-${Date.now()}.jlbackup`);
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(envelope));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream' });
  return file.uri;
}

export async function readEncryptedBackup(
  content: string,
  password: string,
): Promise<{ payload: BackupPayload; metadata: BackupEnvelope['metadata'] }> {
  const parsed = JSON.parse(content) as BackupEnvelope;
  if (parsed.formatVersion !== 1) throw new Error('Versión de backup no compatible.');
  if (
    parsed.kdf.algorithm !== 'PBKDF2-HMAC-SHA256' ||
    parsed.encryption.algorithm !== 'AES-256-GCM' ||
    parsed.kdf.iterations < 100_000
  ) {
    throw new Error('Parámetros criptográficos no aceptados.');
  }
  const key = await deriveKey(password, fromBase64(parsed.kdf.saltBase64), parsed.kdf.iterations);
  const sealed = AESSealedData.fromParts(
    parsed.encryption.nonceBase64,
    parsed.encryption.ciphertextBase64,
    parsed.encryption.authenticationTagBase64,
  );
  const plaintext = await aesDecryptAsync(sealed, key, { additionalData: AAD, output: 'bytes' });
  return {
    payload: JSON.parse(new TextDecoder().decode(plaintext)) as BackupPayload,
    metadata: parsed.metadata,
  };
}
