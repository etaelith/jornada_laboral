import { AESEncryptionKey, getRandomBytesAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { DomainError } from '@/domain/errors';

const KEYRING_KEY = 'jornada.keyring.v1';

export interface LocalKeyring {
  version: 1;
  keyId: string;
  databaseKeyHex: string;
  fieldKeyBase64: string;
  createdAtUtc: number;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function loadOrCreateKeyring(databaseExists: boolean): Promise<LocalKeyring> {
  const stored = await SecureStore.getItemAsync(KEYRING_KEY);
  if (stored) return JSON.parse(stored) as LocalKeyring;
  if (databaseExists) {
    throw new DomainError('KEY_UNAVAILABLE', 'La clave local no está disponible.');
  }

  const databaseKey = await getRandomBytesAsync(32);
  const fieldKey = await AESEncryptionKey.generate(256);
  const keyring: LocalKeyring = {
    version: 1,
    keyId: toHex(await getRandomBytesAsync(16)),
    databaseKeyHex: toHex(databaseKey),
    fieldKeyBase64: await fieldKey.encoded('base64'),
    createdAtUtc: Date.now(),
  };
  await SecureStore.setItemAsync(KEYRING_KEY, JSON.stringify(keyring), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return keyring;
}

export async function deleteLocalKeyring(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYRING_KEY);
}
